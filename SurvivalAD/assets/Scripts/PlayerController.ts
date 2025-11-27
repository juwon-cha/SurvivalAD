import Joystick from "./Joystick";
import GameManager from "./GameManager";
import DroppedItem from "./DroppedItem";
import Monster from "./Monster";
import FenceManager from "./FenceManager";

const {ccclass, property} = cc._decorator;

@ccclass
export default class PlayerController extends cc.Component {

    private joystick: Joystick = null;
    public fenceManager: FenceManager = null; // FenceManager 참조

    // 맵 경계 확인(게임매니저에서 주입 받음)
    @property(cc.Node)
    mapNode: cc.Node = null;

    @property({tooltip: "맵 경계와 플레이어 사이의 여유 공간 (픽셀)"})
    boundaryPadding: number = 0;

    @property
    moveSpeed: number = 300;

    @property(cc.Node)
    stackContainer: cc.Node = null;

    @property({tooltip: "공격 시 몬스터 방향으로 살짝 움직이는 거리입니다."})
    attackNudgeDistance: number = 50;

    @property
    attackRange: number = 200;

    @property
    attackDamage: number = 10;

    @property
    attackCooldown: number = 0.5;
    private attackTimer: number = 0;
    
    // 아이템 수집 범위 (픽셀 단위, 대략 플레이어 크기 + 아이템 크기)
    @property
    collectRadius: number = 100;

    public itemStack: cc.Node[] = []; 
    private stackHeight: number = 10;

    private originalPosition: cc.Vec3 = cc.v3();
    private isAttacking: boolean = false;

    // 스택 컨테이너의 초기 X 위치 (플레이어가 오른쪽 볼 때 기준)
    private stackContainerOriginalX: number = 0;

    // (디버깅)공격, 아이템 획득 범위를 시각적으로 보여줄 그래픽 노드
    private debugGraphics: cc.Graphics = null;
    private debugCollectGraphics: cc.Graphics = null;

    // 애니메이션 컴포넌트
    @property({type: cc.Animation, tooltip: "자식 노드(스프라이트)에 있는 Animation 컴포넌트를 연결하세요."})
    private bodyAnim: cc.Animation = null;
    
    // 현재 상태 추적 (중복 재생 방지)
    private isMoving: boolean = false;

    public setJoystick(joystick: Joystick) {
        this.joystick = joystick;
    }

    start() {
        if (!this.stackContainer) {
            cc.error("PlayerController: stackContainer missing.");
            return;
        }

        this.stackContainerOriginalX = this.stackContainer.x;
        
        if (!this.bodyAnim) {
            this.bodyAnim = this.getComponentInChildren(cc.Animation);
        }

        if (!this.bodyAnim) {
            cc.warn("PlayerController: Animation component not found!");
        } else {
            // 시작할 때 Idle 재생
            this.playAnimation("Idle");
        }

        cc.director.getPhysicsManager().enabled = true;
    }

    update (dt: number) {
        if (this.isAttacking) return;

        let isNowMoving = false;
        let moveVec = cc.Vec3.ZERO;

        if (this.joystick && this.joystick.power > 0) {
            isNowMoving = true;
            
            const currentSpeed = this.moveSpeed * this.joystick.power;
            // moveVec를 cc.Vec3로 변환
            moveVec = new cc.Vec3(this.joystick.dir.x, this.joystick.dir.y, 0).mul(currentSpeed * dt);
        
            // FenceManager를 통해 이동 유효성 검사
            if (this.fenceManager) {
                moveVec = this.fenceManager.validateMovement(this.node.position, moveVec);
            }
            
            this.node.position = this.node.position.add(moveVec);

            // 이동 중 방향 전환 로직
            if (moveVec.x !== 0) {
                const facingDir = moveVec.x > 0 ? 1 : -1;
                this.setFacingDirection(facingDir);
            }
        }

        // 맵 이동 클램핑
        if (this.mapNode) {
            // 맵의 절반 크기 계산 (Anchor 0.5 기준)
            const mapHalfW = this.mapNode.width / 2;
            const mapHalfH = this.mapNode.height / 2;

            // 플레이어의 실제 크기 계산 (스케일 고려)
            // scaleX가 -1(반전)일 수 있으므로 Math.abs 필수
            const playerHalfW = (this.node.width * Math.abs(this.node.scaleX)) / 2;
            const playerHalfH = (this.node.height * Math.abs(this.node.scaleY)) / 2;

            // 이동 가능한 한계 좌표 계산
            // (맵 끝) - (내 몸집 절반) - (추가 여백)
            const minX = -mapHalfW + playerHalfW + this.boundaryPadding;
            const maxX = mapHalfW - playerHalfW - this.boundaryPadding;
            const minY = -mapHalfH + playerHalfH + this.boundaryPadding;
            const maxY = mapHalfH - playerHalfH - this.boundaryPadding;

            // 좌표 강제 고정 (Clamp)
            // 맵이 플레이어보다 작을 경우를 대비해 min < max 체크
            if (minX < maxX) {
                this.node.x = cc.misc.clampf(this.node.x, minX, maxX);
            } else {
                this.node.x = 0; // 맵이 너무 작으면 중앙 고정
            }

            if (minY < maxY) {
                this.node.y = cc.misc.clampf(this.node.y, minY, maxY);
            } else {
                this.node.y = 0;
            }
        }

        // 애니메이션 상태 전환
        if (isNowMoving && moveVec.mag() > 0) { // 실제로 움직임이 있을 때만
            if (!this.isMoving) {
                this.isMoving = true;
                this.playAnimation("Walk");
            }
        } else {
            if (this.isMoving) {
                this.isMoving = false;
                this.playAnimation("Idle");
            }
        }

        // 공격 쿨타임 로직
        this.attackTimer += dt;
        if (this.attackTimer >= this.attackCooldown) {
            this.findAndAttackMonster();
        }

        this.checkItemCollection();
    }
    
    // 방향 전환 함수 (몸통 + 가방 동시 처리)
    setFacingDirection(dir: number) {
        // dir: 1 (오른쪽), -1 (왼쪽)
        
        // 몸통(스프라이트) 반전
        if (this.bodyAnim) {
            this.bodyAnim.node.scaleX = Math.abs(this.bodyAnim.node.scaleX) * dir;
        } else {
            this.node.scaleX = Math.abs(this.node.scaleX) * dir;
        }

        // 스택 컨테이너 위치 반전 (등 뒤로 보내기)
        // 초기 X값이 음수(왼쪽)였다면, dir이 1일 때 음수 유지, dir이 -1일 때 양수로 반전
        if (this.stackContainer) {
            this.stackContainer.x = this.stackContainerOriginalX * dir;
        }
    }

    // 애니메이션 재생 헬퍼 함수
    playAnimation(name: string) {
        if (!this.bodyAnim) return;
        
        // 해당 이름의 클립이 있는지 확인하고 재생
        const state = this.bodyAnim.getAnimationState(name);
        if (state) {
            this.bodyAnim.play(name);
        } else {
            cc.warn(`Animation clip '${name}' not found!`);
        }
    }

    findAndAttackMonster() {
        if (this.isAttacking) return;

        const monsters = GameManager.instance.monsterManager.activeMonsters;
        if (!monsters || monsters.length === 0) return;

        let nearestMonster: cc.Node = null;
        let minDistSqr = this.attackRange * this.attackRange;

        // 카메라 가져오기 (GameManager를 통해 가져오거나 직접 찾음)
        let camera = cc.Camera.main;
        if (!camera) return;

        // 월드 좌표 대신 화면 좌표로 변환해서 비교
        // 화면상에 보이는 위치 그대로 거리를 잼 (가장 직관적임)
        let playerScreenPos = cc.v2();
        camera.getWorldToScreenPoint(this.node.parent.convertToWorldSpaceAR(this.node.position), playerScreenPos);

        for (let monsterNode of monsters) {
            if (!monsterNode.active) continue;

            let monsterScreenPos = cc.v2();
            camera.getWorldToScreenPoint(monsterNode.parent.convertToWorldSpaceAR(monsterNode.position), monsterScreenPos);
            
            // 2D 화면 좌표끼리 거리 계산(z축 배제)
            let distSqr = playerScreenPos.sub(monsterScreenPos).magSqr();

            if (distSqr <= minDistSqr) {
                minDistSqr = distSqr;
                nearestMonster = monsterNode;
            }
        }

        if (nearestMonster) {
            this.attack(nearestMonster);
            this.attackTimer = 0; 
        }
    }

    attack(monsterNode: cc.Node) {
        this.isAttacking = true;
        
        // 원래 위치 저장
        this.originalPosition = this.node.position.clone();
        
        // 몬스터 위치 및 방향 계산
        let monsterWorldPos = monsterNode.parent.convertToWorldSpaceAR(monsterNode.position);
        let targetLocalPos = this.node.parent.convertToNodeSpaceAR(monsterWorldPos);

        let startPos2D = cc.v2(this.originalPosition.x, this.originalPosition.y);
        let targetPos2D = cc.v2(targetLocalPos.x, targetLocalPos.y);
        let direction = targetPos2D.sub(startPos2D); // 플레이어 -> 몬스터 벡터

        // 공격 시작 전 몬스터 방향으로 몸 돌리기 (좌우 반전)
        // x값 차이가 있을 때만 회전
        if (Math.abs(direction.x) > 0.1) { 
            const facingDir = direction.x > 0 ? 1 : -1;
            this.setFacingDirection(facingDir);
        }

        // 애니메이션 재생
        this.playAnimation("Attack");

        // 살짝 이동할 위치 계산 (Nudge)
        let nudgeOffset = direction.normalize().mul(this.attackNudgeDistance);
        let finalNudgePosX = this.originalPosition.x + nudgeOffset.x;
        let finalNudgePosY = this.originalPosition.y + nudgeOffset.y;

        // 공격 액션 Tween
        cc.tween(this.node)
            .to(0.1, { x: finalNudgePosX, y: finalNudgePosY }, { easing: 'quadOut' }) 
            .call(() => {
                // 타격 시점
                if (cc.isValid(monsterNode) && monsterNode.active) {
                    const monster = monsterNode.getComponent(Monster);
                    if (monster) {
                        monster.takeDamage(this.attackDamage);
                    }
                }
            })
            .to(0.15, { x: this.originalPosition.x, y: this.originalPosition.y }, { easing: 'quadIn' }) 
            .call(() => {
                // 공격 종료 시 상태 판단
                this.isAttacking = false; 

                // 현재 조이스틱 입력이 있는지 확인
                if (this.joystick && this.joystick.power > 0) {
                    // 이동 중이라면 바로 걷기 애니메이션 재생
                    this.playAnimation("Walk");
                    // update문에서 중복 재생을 막기 위해 플래그도 맞춰줌
                    this.isMoving = true; 
                } else {
                    // 멈춰 있다면 대기 애니메이션 재생
                    this.playAnimation("Idle");
                    this.isMoving = false;
                }
            })
            .start();
    }

    // 거리 기반 아이템 수집
    checkItemCollection() {
        const items = GameManager.instance.itemManager.activeItems;
        
        // 아이템 리스트가 비어있는지 확인
        if (!items || items.length === 0) {
            return;
        }

        // 카메라 가져오기 (메인 카메라 사용)
        let camera = cc.Camera.main;
        if (!camera) {
            cc.warn("checkItemCollection: Main camera not found.");
            return;
        }

        // 거리 계산 최적화 (제곱 거리 사용)
        const collectRadiusSqr = this.collectRadius * this.collectRadius;
        
        // 플레이어의 화면 좌표
        if (!this.node.parent) return; // 부모가 없으면 월드 좌표 계산 불가
        let playerScreenPos = cc.v2();
        camera.getWorldToScreenPoint(this.node.parent.convertToWorldSpaceAR(this.node.position), playerScreenPos);


        for (let i = items.length - 1; i >= 0; i--) {
            let itemNode = items[i];
            
            // 아이템 유효성 검사
            if (!cc.isValid(itemNode)) {
                GameManager.instance.itemManager.activeItems.splice(i, 1);
                continue;
            }
            if (!itemNode.active) continue; // 비활성화된 아이템은 건너뛰기
            if (!itemNode.parent) continue; // 부모가 없으면 월드 좌표 계산 불가

            // 아이템의 화면 좌표
            let itemScreenPos = cc.v2();
            camera.getWorldToScreenPoint(itemNode.parent.convertToWorldSpaceAR(itemNode.position), itemScreenPos);
            
            // 2D 화면 좌표끼리 거리 계산 (z축 완전 배제됨)
            let distSqr = playerScreenPos.sub(itemScreenPos).magSqr();
            let dist = Math.sqrt(distSqr);

            // 수집 범위 체크
            if (distSqr < collectRadiusSqr) {
                console.log("아이템 수집 성공!"); 
                this.collectItem(itemNode);
            }
        }
    }

    // 아이템 수집
    collectItem(itemNode: cc.Node) {
        // 중복 수집 방지
        const idx = GameManager.instance.itemManager.activeItems.indexOf(itemNode);
        if (idx === -1) return; 

        GameManager.instance.itemManager.notifyItemCollected(itemNode);

        // 기존에 실행 중이던 모든 트윈(드랍 애니메이션 등) 중지
        // 이게 없으면 드랍되는 도중에 수집될 때 위치가 튀거나 사라질 수 있다
        cc.Tween.stopAllByTarget(itemNode);

        // 좌표 변환 로직 (기존 유지)
        let itemWorldPos = itemNode.parent.convertToWorldSpaceAR(itemNode.position);
        itemNode.parent = this.stackContainer;
        let targetLocalPos = this.stackContainer.convertToNodeSpaceAR(itemWorldPos);
        itemNode.setPosition(targetLocalPos);
        
        // 초기 상태 리셋
        itemNode.scale = 1;
        itemNode.angle = 0;
        itemNode.opacity = 255; // 혹시 투명해졌을까봐
        itemNode.active = true; // 혹시 꺼졌을까봐

        const targetY = this.itemStack.length * this.stackHeight;
        
        // 수집 애니메이션
        cc.tween(itemNode)
            .to(0.2, { x: 0, y: targetY, scale: 0.8 }, { easing: 'backOut' }) 
            .call(() => {
                // 애니메이션 끝난 후 위치/스케일 재확인
                itemNode.setPosition(0, targetY);
                itemNode.setScale(0.8);
            })
            .start();

        this.itemStack.push(itemNode);
    }

    // 아이템 스택에서 하나 제거하고 반환
    popItem(): cc.Node | null {
        if (this.itemStack.length === 0) {
            return null;
        }

        return this.itemStack.pop();
    }
}

