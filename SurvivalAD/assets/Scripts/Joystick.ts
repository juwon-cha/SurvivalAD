const { ccclass, property } = cc._decorator;

@ccclass
export default class Joystick extends cc.Component {

    @property(cc.Node)
    stickNode: cc.Node = null;

    @property
    maxRadius: number = 100;

    @property({
        type: cc.Camera,
        tooltip: 'UI를 렌더링하는 UICamera를 연결해주세요.'
    })
    camera: cc.Camera = null;

    public dir: cc.Vec2 = cc.v2(0, 0);
    public power: number = 0;

    private _touchStartWorldPos: cc.Vec3 = new cc.Vec3();
    private _currentTouchWorldPos: cc.Vec3 = new cc.Vec3();

    onLoad() {
        this.reset();
        this.node.active = false;

        if (!this.camera) {
            cc.error("Joystick 컴포넌트의 Camera 속성에 UICamera를 반드시 연결해야 합니다!");
        }
    }

    public onTouchStart(screenPos: cc.Vec2) {
        if (!this.camera) return;
        this.node.active = true;
        
        this.camera.getScreenToWorldPoint(screenPos, this._touchStartWorldPos);
        const localPos = this.node.parent.convertToNodeSpaceAR(this._touchStartWorldPos);
        this.node.setPosition(localPos);

        this.reset();
    }

    public onTouchMove(screenPos: cc.Vec2) {
        if (!this.camera) return;

        this.camera.getScreenToWorldPoint(screenPos, this._currentTouchWorldPos);
        
        const offset = this._currentTouchWorldPos.subtract(this._touchStartWorldPos);
        const len = offset.mag();

        this.power = Math.min(len / this.maxRadius, 1.0);
        if (len > 0) {
            this.dir = cc.v2(offset.x, offset.y).normalize();
        }

        let stickPos = cc.v2(offset.x, offset.y);
        if (len > this.maxRadius) {
            stickPos = stickPos.normalize().mul(this.maxRadius);
        }
        this.stickNode.setPosition(stickPos);
    }

    public onTouchEnd() {
        this.reset();
        this.node.active = false;
    }

    private reset() {
        this.dir = cc.v2(0, 0);
        this.power = 0;
        this.stickNode.setPosition(0, 0);
    }
}
