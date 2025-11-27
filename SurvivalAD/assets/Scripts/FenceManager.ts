import PlayerController from "./PlayerController";

const {ccclass, property} = cc._decorator;

@ccclass
export default class FenceManager extends cc.Component {

    // 울타리들이 모여있는 부모 노드 (이 아래에 여러 개의 Fence 조각들이 있어야 함)
    @property(cc.Node)
    public fenceGroup: cc.Node = null;

    // 문 (좌/우 노드가 자식으로 있어야 함)
    @property(cc.Node)
    public gateNode: cc.Node = null;

    @property(cc.Node)
    public leftDoor: cc.Node = null;

    @property(cc.Node)
    public rightDoor: cc.Node = null;

    private playerNode: cc.Node = null;
    private fenceRects: cc.Rect[] = []; // 최적화를 위해 Rect 미리 계산
    private isGateOpen: boolean = false;
    private gateTriggerRadius: number = 100; // 문 감지 범위

    // 문이 원래 있던 위치 저장용
    private leftDoorOriginX: number = 0;
    private rightDoorOriginX: number = 0;

    start() {
        // 모든 울타리 조각의 월드 Rect 미리 계산 및 저장
        if (this.fenceGroup) {
            this.fenceGroup.children.forEach(child => {
                // 노드의 크기가 있어야 함 (Sprite나 UITransform 등의 Size 확인 필요)
                if (child.width > 0 && child.height > 0) {
                    const worldBox = child.getBoundingBoxToWorld();
                    this.fenceRects.push(worldBox);
                }
            });
        }

        // 시작할 때 문들의 원래 X 좌표 기억
        if (this.leftDoor) this.leftDoorOriginX = this.leftDoor.x;
        if (this.rightDoor) this.rightDoorOriginX = this.rightDoor.x;
    }

    public setPlayer(player: cc.Node) {
        this.playerNode = player;
    }

    update(dt: number) {
        if (!this.playerNode || !this.gateNode) return;

        // 문 자동 열림/닫힘 체크 (거리 기반)
        const playerWorldPos = this.playerNode.parent.convertToWorldSpaceAR(this.playerNode.position);
        const gateWorldPos = this.gateNode.parent.convertToWorldSpaceAR(this.gateNode.position);
        
        // Z축 무시하고 2D 거리 계산
        const dist = cc.v2(playerWorldPos.x, playerWorldPos.y).sub(cc.v2(gateWorldPos.x, gateWorldPos.y)).mag();

        if (dist < this.gateTriggerRadius)
        {
            if (!this.isGateOpen)
            {
                // 미닫이는 방향 상관없이 열기
                this.openGate();
            }
        }
        else
        {
            if (this.isGateOpen)
            {
                this.closeGate();
            }
        }
    }

    // PlayerController에서 이동 전 호출하여 갈 수 있는 곳인지 확인
    public validateMovement(currentPos: cc.Vec3, moveVec: cc.Vec3): cc.Vec3 {
        if (this.fenceRects.length === 0 || !this.playerNode) return moveVec;

        // 플레이어의 예상 다음 위치 (월드 좌표)
        const nextLocalPos = currentPos.add(moveVec);
        const nextWorldPos = this.playerNode.parent.convertToWorldSpaceAR(nextLocalPos);
        
        // 플레이어의 충돌 박스 (Anchor 0.5 가정)
        // 플레이어 크기만큼의 Rect 생성 (약간 여유를 두어 40x40 정도로 가정)
        const pSize = 40; 
        const playerRect = new cc.Rect(
            nextWorldPos.x - pSize/2, 
            nextWorldPos.y - pSize/2, 
            pSize, 
            pSize
        );

        // 문이 열려있으면 문 근처의 울타리는 무시해야 할 수도 있지만, 
        // 보통 문은 울타리가 없는 빈 공간에 배치하므로 별도 처리 불필요.
        // 만약 문 자체가 울타리 역할을 한다면 isGateOpen 체크 필요.
        // 울타리 충돌 검사
        for (let rect of this.fenceRects) {
            if (rect.intersects(playerRect)) {
                // 충돌 발생!
                // 미끄러짐 처리: X축만 이동해보고 괜찮으면 X만 허용, Y도 마찬가지
                let correctedMove = cc.Vec3.ZERO;

                // X축 이동 테스트
                let testPosX = currentPos.add(cc.v3(moveVec.x, 0, 0));
                let testWorldPosX = this.playerNode.parent.convertToWorldSpaceAR(testPosX);
                let playerRectX = new cc.Rect(testWorldPosX.x - pSize/2, testWorldPosX.y - pSize/2, pSize, pSize);
                
                let hitX = false;
                for (let r of this.fenceRects) {
                    if (r.intersects(playerRectX)) { hitX = true; break; }
                }
                if (!hitX) correctedMove.x = moveVec.x;

                // Y축 이동 테스트
                let testPosY = currentPos.add(cc.v3(0, moveVec.y, 0));
                let testWorldPosY = this.playerNode.parent.convertToWorldSpaceAR(testPosY);
                let playerRectY = new cc.Rect(testWorldPosY.x - pSize/2, testWorldPosY.y - pSize/2, pSize, pSize);
                
                let hitY = false;
                for (let r of this.fenceRects) {
                    if (r.intersects(playerRectY)) { hitY = true; break; }
                }
                if (!hitY) correctedMove.y = moveVec.y;

                return correctedMove;
            }
        }

        return moveVec; // 충돌 없음, 원래 이동 벡터 반환
    }

    // 미닫이 문 열기
    private openGate() {
        if (this.isGateOpen) return;
        this.isGateOpen = true;

        cc.Tween.stopAllByTarget(this.leftDoor);
        cc.Tween.stopAllByTarget(this.rightDoor);

        // 왼쪽 문은 왼쪽으로 자신의 너비만큼 이동 (혹은 0.8배 정도만)
        const slideDist = this.leftDoor.width * 0.9; 

        cc.tween(this.leftDoor)
            .to(0.5, { x: this.leftDoorOriginX - slideDist }, { easing: 'cubicOut' })
            .start();

        cc.tween(this.rightDoor)
            .to(0.5, { x: this.rightDoorOriginX + slideDist }, { easing: 'cubicOut' })
            .start();
    }

    // 미닫이 문 닫기 (원위치 복귀)
    private closeGate() {
        if (!this.isGateOpen) return;
        this.isGateOpen = false;

        cc.Tween.stopAllByTarget(this.leftDoor);
        cc.Tween.stopAllByTarget(this.rightDoor);

        cc.tween(this.leftDoor)
            .to(0.5, { x: this.leftDoorOriginX }, { easing: 'cubicIn' })
            .start();

        cc.tween(this.rightDoor)
            .to(0.5, { x: this.rightDoorOriginX }, { easing: 'cubicIn' })
            .start();
    }
}
