
import MonsterManager from "./MonsterManager";
import ItemManager from "./ItemManager";
import CameraFollow from "./CameraFollow";
import FenceManager from "./FenceManager"; // 추가

const {ccclass, property} = cc._decorator;

@ccclass
export default class GameManager extends cc.Component {

    public static instance: GameManager = null;

    @property(cc.Node)
    public mapNode: cc.Node = null;

    @property(MonsterManager)
    public monsterManager: MonsterManager = null;

    @property(ItemManager)
    public itemManager: ItemManager = null;

    @property(cc.Prefab)
    public playerPrefab: cc.Prefab = null;
    
    @property(CameraFollow)
    public cameraFollow: CameraFollow = null;

    @property(cc.Node)
    public gameLayer: cc.Node = null;

    // FenceManager 참조
    @property(FenceManager)
    public fenceManager: FenceManager = null;

    public playerInstance: cc.Node = null;

    onLoad() {
        if (GameManager.instance === null) {
            GameManager.instance = this;
        } else {
            this.destroy();
            return;
        }
    }

    start() {
        if (!this.monsterManager) { cc.error("GameManager: 'monsterManager' is not assigned."); return; }
        if (!this.itemManager) { cc.error("GameManager: 'itemManager' is not assigned."); return; }
        if (!this.playerPrefab) { cc.error("GameManager: 'playerPrefab' is not assigned."); return; }
        if (!this.cameraFollow) { cc.error("GameManager: 'cameraFollow' is not assigned."); return; }
        if (!this.gameLayer) { cc.error("GameManager: 'gameLayer' is not assigned."); return; }
        if (!this.fenceManager) { cc.error("GameManager: 'fenceManager' is not assigned."); return; }


        // 플레이어 스폰
        this.playerInstance = cc.instantiate(this.playerPrefab);
        this.playerInstance.parent = this.gameLayer;
        this.playerInstance.setPosition(this.cameraFollow.node.position);

        // 생성된 플레이어에게 정보 주입
        const playerCtrl = this.playerInstance.getComponent("PlayerController");
        if (playerCtrl) {
            playerCtrl.mapNode = this.mapNode;
            // FenceManager 참조를 플레이어에게 전달
            playerCtrl.fenceManager = this.fenceManager;
        }

        // FenceManager에 플레이어 정보 주입
        this.fenceManager.setPlayer(this.playerInstance);

        // 카메라 타겟 설정
        this.cameraFollow.target = this.playerInstance;

        // 몬스터 타겟 설정
        this.monsterManager.setPlayerTarget(this.playerInstance);

        // 몬스터 스폰
        this.monsterManager.initialSpawn();
    }
}
