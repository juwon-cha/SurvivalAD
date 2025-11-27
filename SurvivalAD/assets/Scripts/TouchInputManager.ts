import Joystick from "./Joystick";
import PlayerController from "./PlayerController";
import GameManager from "./GameManager";

const {ccclass, property} = cc._decorator;

@ccclass
export default class TouchInputManager extends cc.Component {

    @property(Joystick)
    joystick: Joystick = null;

    @property(cc.Node)
    touchArea: cc.Node = null; 

    private playerController: PlayerController = null;
    private touchId: number = null;

    onLoad() {
        if (!this.joystick) {
            cc.error("TouchInputManager: Joystick is not assigned.");
            return;
        }

        // 시작 시 조이스틱 숨김
        this.joystick.node.active = false;

        this.touchArea.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.touchArea.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.touchArea.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.touchArea.on(cc.Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    start() {
        this.scheduleOnce(() => {
            if (GameManager.instance && GameManager.instance.playerInstance) {
                this.playerController = GameManager.instance.playerInstance.getComponent(PlayerController);
                if (this.playerController) {
                    this.playerController.setJoystick(this.joystick);
                }
            }
        }, 0.1);
    }

    onTouchStart(event: cc.Event.EventTouch) {
        if (this.touchId !== null) return;

        this.touchId = event.getID();
        
        // 화면 좌표 그대로 전달
        this.joystick.onTouchStart(event.getLocation());
    }

    onTouchMove(event: cc.Event.EventTouch) {
        if (event.getID() !== this.touchId) return;
        this.joystick.onTouchMove(event.getLocation());
    }

    onTouchEnd(event: cc.Event.EventTouch) {
        if (event.getID() !== this.touchId) return;
        
        this.joystick.onTouchEnd();
        this.touchId = null;
    }
}
