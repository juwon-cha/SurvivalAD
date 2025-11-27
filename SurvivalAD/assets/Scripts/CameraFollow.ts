const {ccclass, property} = cc._decorator;

@ccclass
export default class CameraFollow extends cc.Component {

    @property(cc.Node)
    public target: cc.Node = null;

    @property
    public smoothing: number = 0.1;

    // 맵의 경계를 알기 위해 맵 노드 연결
    @property(cc.Node)
    public mapNode: cc.Node = null;

    private camera: cc.Camera = null;

    start() {
        this.camera = this.getComponent(cc.Camera);
    }

    lateUpdate(dt: number) {
        if (!this.target) return;

        // 목표 위치 계산
        let targetPos = new cc.Vec3(this.target.position.x, this.target.position.y, this.node.position.z);
        let currentPos = this.node.position;
        let newPos = currentPos.lerp(targetPos, this.smoothing);

        // 맵 밖으로 나가지 않도록 클램핑
        if (this.mapNode && this.camera) {
            // 화면의 크기(보이는 영역)를 구합니다. (줌 비율 고려)
            const zoomRatio = this.camera.zoomRatio;
            const halfScreenW = (cc.winSize.width / 2) / zoomRatio;
            const halfScreenH = (cc.winSize.height / 2) / zoomRatio;

            // 맵의 절반 크기 (Anchor 0.5, 0.5 가정)
            const halfMapW = this.mapNode.width / 2;
            const halfMapH = this.mapNode.height / 2;

            // 카메라가 갈 수 있는 한계점 계산
            // (맵 끝 - 화면 절반) 만큼만 갈 수 있음
            const minX = -halfMapW + halfScreenW;
            const maxX = halfMapW - halfScreenW;
            const minY = -halfMapH + halfScreenH;
            const maxY = halfMapH - halfScreenH;

            // clampf 함수로 좌표 제한 (맵이 화면보다 작을 경우 방어 코드 포함)
            if (minX < maxX) {
                newPos.x = cc.misc.clampf(newPos.x, minX, maxX);
            } else {
                newPos.x = 0; // 맵이 화면보다 작으면 중앙 고정
            }

            if (minY < maxY) {
                newPos.y = cc.misc.clampf(newPos.y, minY, maxY);
            } else {
                newPos.y = 0;
            }
        }
        
        this.node.setPosition(newPos);
    }
}
