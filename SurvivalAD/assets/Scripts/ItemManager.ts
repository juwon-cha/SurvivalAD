const {ccclass, property} = cc._decorator;

@ccclass
export default class ItemManager extends cc.Component {

    @property(cc.Prefab)
    private itemPrefab: cc.Prefab = null;

    @property(cc.Node)
    private itemLayer: cc.Node = null;

    private itemPool: cc.NodePool;

    public activeItems: cc.Node[] = [];

    onLoad() {
        this.itemPool = new cc.NodePool('DroppedItem');
    }

    start() {
        if (!this.itemPrefab) {
            cc.error("ItemManager: 'itemPrefab' is not assigned. Please assign an item prefab in the editor.");
            return;
        }
        if (!this.itemLayer) {
            cc.error("ItemManager: 'itemLayer' is not assigned. Please assign a node for items to be children of.");
            return;
        }

        let initCount = 20; // 초기 풀 크기
        for (let i = 0; i < initCount; ++i) {
            let item = cc.instantiate(this.itemPrefab);
            this.itemPool.put(item);
        }
    }

    // 인자로 들어오는 position은 이제 월드 좌표
    public spawnItem(worldPosition: cc.Vec3): cc.Node {
        let itemNode: cc.Node = null;
        if (this.itemPool.size() > 0) {
            itemNode = this.itemPool.get();
        } else {
            itemNode = cc.instantiate(this.itemPrefab);
        }

        itemNode.parent = this.itemLayer;

        // 월드 좌표를 itemLayer 기준 로컬 좌표로 변환
        // "전체 지도상의 (1000, 1000) 위치는 내(itemLayer) 기준으로 어디인가?"를 계산
        let localPos = this.itemLayer.convertToNodeSpaceAR(worldPosition);
        itemNode.setPosition(localPos);
        
        // 활성 리스트에 추가
        this.activeItems.push(itemNode);

        itemNode.scale = 1.0; 
        itemNode.angle = 0;

        // 드랍 연출
        const randX = (Math.random() - 0.5) * 80;
        const randY = (Math.random() - 0.5) * 80;

        cc.tween(itemNode)
            .by(0.4, { position: cc.v3(randX, randY, 0) }, { easing: 'bounceOut' })
            .start();

        return itemNode;
    }

    public despawnItem(itemNode: cc.Node) {
        // 활성 리스트에서 제거
        const index = this.activeItems.indexOf(itemNode);
        if (index > -1) {
            this.activeItems.splice(index, 1);
        }

        this.itemPool.put(itemNode);
    }

    // 플레이어가 아이템을 획득했을 때 호출되어 activeItems 목록에서 아이템 제거
    public notifyItemCollected(itemNode: cc.Node) {
        const index = this.activeItems.indexOf(itemNode);
        if (index > -1) {
            this.activeItems.splice(index, 1);
        }
    }
}