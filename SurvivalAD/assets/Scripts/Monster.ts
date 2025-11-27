import GameManager from "./GameManager";
import HealthBar from "./HealthBar";

const {ccclass, property} = cc._decorator;

@ccclass
export default class Monster extends cc.Component {

    @property
    maxHp: number = 30;
    private hp: number = 30;

    @property
    healthBarOffsetY: number = 120;
    
    // 스프라이트가 있는 자식 노드 (없으면 본체를 뒤집음)
    // 에디터에서 연결해주면 좋고, 안 해도 본체 뒤집기로 동작함
    @property(cc.Node)
    bodyNode: cc.Node = null;

    // 패트롤 관련 설정
    private readonly PATROL_SPEED_RATIO: number = 0.9; // 추적 속도의 90%로 순찰
    private readonly PATROL_WAIT_TIME: number = 1.0;   // 도착 후 초 대기
    private readonly ARRIVAL_THRESHOLD: number = 10.0; // 목표 도달 판단 거리

    private speed: number = 0; 
    private detectionRange: number = 0; 
    private huntingAreaWorldRect: cc.Rect = null; 

    private healthBar: HealthBar = null;
    private playerNode: cc.Node = null; 

    // 패트롤 상태 변수
    private patrolTargetWorldPos: cc.Vec2 = null; // 현재 순찰 목표 (월드 좌표)
    private idleTimer: number = 0;                // 대기 타이머

    public init(speed: number, player: cc.Node, detectionRange: number, huntingAreaWorldRect: cc.Rect) { 
        this.hp = this.maxHp;
        this.node.active = true;
        this.node.color = cc.Color.WHITE;
        this.node.opacity = 255;
        
        // 렌더링 대상 노드 가져오기 (bodyNode 혹은 자기 자신)
        const targetNode = this.bodyNode ? this.bodyNode : this.node;

        // 남아있을 수 있는 모든 Tween(피격 효과 등)을 즉시 중단
        cc.Tween.stopAllByTarget(targetNode);

        // 색상 및 스케일 초기화
        targetNode.color = cc.Color.WHITE;
        targetNode.scaleX = Math.abs(targetNode.scaleX); // 방향 초기화 (절댓값)

        this.speed = speed;
        this.playerNode = player;
        this.detectionRange = detectionRange; 
        this.huntingAreaWorldRect = huntingAreaWorldRect;
        
        // 패트롤 변수 리셋
        this.patrolTargetWorldPos = null;
        this.idleTimer = 0;

        const healthBarNode = GameManager.instance.monsterManager.getHealthBar();
        this.healthBar = healthBarNode.getComponent(HealthBar);
        healthBarNode.parent = this.node;
        healthBarNode.setPosition(0, this.healthBarOffsetY);
        
        // 체력바 스케일은 몬스터가 뒤집혀도 정방향 유지해야 함 (아래 update 참고)
        healthBarNode.scaleX = 1; 

        this.healthBar.updateHealth(this.hp, this.maxHp);
        this.healthBar.node.active = true;
    }

    takeDamage(damage: number) {
        if (!this.node.active)
        {
            return;
        }

        this.hp -= damage;

        if(this.healthBar)
        {
            this.healthBar.updateHealth(this.hp, this.maxHp);
        }
        
        // 피격 효과 대상을 bodyNode
        // bodyNode가 연결되어 있으면 그것을 쓰고 없으면 본체 씀
        const targetNode = this.bodyNode ? this.bodyNode : this.node;

        // 기존 트윈 멈추고 빨강 -> 흰색 깜빡임
        cc.Tween.stopAllByTarget(targetNode);
        cc.tween(targetNode)
            .to(0.05, { color: cc.Color.RED })
            .to(0.05, { color: cc.Color.WHITE })
            .start();

        if (this.hp <= 0) this.die();
    }

    die() {
        const targetNode = this.bodyNode ? this.bodyNode : this.node;
        cc.Tween.stopAllByTarget(targetNode);

        // 월드 좌표 전달
        let worldPos = this.node.parent.convertToWorldSpaceAR(this.node.position);
        GameManager.instance.itemManager.spawnItem(cc.v3(worldPos.x, worldPos.y, 0));

        if (this.healthBar) {
            GameManager.instance.monsterManager.putHealthBar(this.healthBar.node);
            this.healthBar = null;
        }
        GameManager.instance.monsterManager.despawnMonster(this.node);
    }

    update(dt: number) {
        if (!this.playerNode || !this.playerNode.active) return;

        // 현재 위치와 플레이어 위치 (월드 좌표)
        const monsterWorldPos = this.node.parent.convertToWorldSpaceAR(this.node.position);
        const playerWorldPos = this.playerNode.parent.convertToWorldSpaceAR(this.playerNode.position);

        const mPos2 = cc.v2(monsterWorldPos.x, monsterWorldPos.y);
        const pPos2 = cc.v2(playerWorldPos.x, playerWorldPos.y);
        const distToPlayer = mPos2.sub(pPos2).mag();
        
        if (distToPlayer <= this.detectionRange) {
            // 플레이어 추적
            // 추적 모드로 전환되면 패트롤 타겟은 초기화 (추적 끝나면 다시 잡기 위해)
            this.patrolTargetWorldPos = null; 
            this.idleTimer = 0;

            this.moveTowards(mPos2, pPos2, this.speed, dt);
        } 
        else {
            // 패트롤
            this.updatePatrol(mPos2, dt);
        }
    }

    // 패트롤 로직
    updatePatrol(currentWorldPos: cc.Vec2, dt: number) {
        // 대기 중이라면 타이머 감소
        if (this.idleTimer > 0) {
            this.idleTimer -= dt;
            return; // 움직이지 않고 대기
        }

        // 목표 지점이 없다면 새로 설정
        if (!this.patrolTargetWorldPos) {
            this.setNewPatrolTarget();
            return;
        }

        // 목표 지점까지 거리 확인
        const distToTarget = currentWorldPos.sub(this.patrolTargetWorldPos).mag();

        if (distToTarget < this.ARRIVAL_THRESHOLD) {
            // 도착했다면 대기 시작
            this.patrolTargetWorldPos = null;
            this.idleTimer = this.PATROL_WAIT_TIME;
        } else {
            // 이동 (속도는 좀 더 느리게)
            this.moveTowards(currentWorldPos, this.patrolTargetWorldPos, this.speed * this.PATROL_SPEED_RATIO, dt);
        }
    }

    // 랜덤 목표 지점 설정
    setNewPatrolTarget() {
        if (!this.huntingAreaWorldRect) return;

        const rect = this.huntingAreaWorldRect;
        // 사냥터 범위 내 랜덤 좌표 생성
        const randomX = rect.x + Math.random() * rect.width;
        const randomY = rect.y + Math.random() * rect.height;

        this.patrolTargetWorldPos = cc.v2(randomX, randomY);
    }

    // 이동 공통 로직 분리 (추적/패트롤 모두 사용)
    moveTowards(currentPos: cc.Vec2, targetPos: cc.Vec2, speed: number, dt: number) {
        const direction = targetPos.sub(currentPos).normalize();
        const moveStep = direction.mul(speed * dt);
        
        // 방향 전환 (Flip)
        if (Math.abs(moveStep.x) > 0.1) {
            const facingDir = moveStep.x > 0 ? 1 : -1; 
            
            if (this.bodyNode) {
                this.bodyNode.scaleX = Math.abs(this.bodyNode.scaleX) * facingDir;
            } else {
                this.node.scaleX = Math.abs(this.node.scaleX) * facingDir;
                if (this.healthBar) {
                    this.healthBar.node.scaleX = facingDir; 
                }
            }
        }

        let nextWorldPos = currentPos.add(moveStep);

        // 사냥터 밖으로 나가지 않게 Clamp
        if (this.huntingAreaWorldRect) {
            const rect = this.huntingAreaWorldRect;
            nextWorldPos.x = cc.misc.clampf(nextWorldPos.x, rect.xMin, rect.xMax);
            nextWorldPos.y = cc.misc.clampf(nextWorldPos.y, rect.yMin, rect.yMax);
        }
        
        // 최종 좌표 적용
        const finalLocalPos = this.node.parent.convertToNodeSpaceAR(cc.v3(nextWorldPos.x, nextWorldPos.y, 0));
        this.node.setPosition(finalLocalPos);
    }
}
