import Monster from "./Monster";
import GameManager from "./GameManager";

const {ccclass, property} = cc._decorator;

@ccclass
export default class MonsterManager extends cc.Component {

    @property(cc.Prefab)
    private monsterPrefab: cc.Prefab = null;

    @property(cc.Prefab)
    private healthBarPrefab: cc.Prefab = null;

    @property(cc.Node)
    private monsterLayer: cc.Node = null;
    
    @property(cc.Node)
    private huntingArea: cc.Node = null;

    @property
    public maxMonsters: number = 20;

    @property({tooltip: "몬스터 기본 이동 속도"})
    public baseSpeed: number = 30; 

    @property({tooltip: "속도 랜덤 범위 (예: 20이면 baseSpeed ± 10)"})
    public speedVariance: number = 20;

    @property
    public detectionRange: number = 200;

    private playerNode: cc.Node = null; 
    private _huntingAreaWorldRect: cc.Rect = null; // Stored hunting area in world coordinates

    private monsterPool: cc.NodePool;
    private healthBarPool: cc.NodePool;
    public activeMonsters: cc.Node[] = [];

    onLoad() {
        this.monsterPool = new cc.NodePool('Monster');
        this.healthBarPool = new cc.NodePool('HealthBar');
    }
    
    start() {
        if (!this.monsterPrefab) {
            cc.error("MonsterManager: 'monsterPrefab' is not assigned. Please assign a monster prefab in the editor.");
            return;
        }
        if (!this.healthBarPrefab) {
            cc.error("MonsterManager: 'healthBarPrefab' is not assigned. Please assign the HealthBar prefab in the editor.");
            return;
        }
        if (!this.monsterLayer) {
            cc.error("MonsterManager: 'monsterLayer' is not assigned. Please assign a node for monsters to be children of.");
            return;
        }
        if (!this.huntingArea) {
            cc.error("MonsterManager: 'huntingArea' is not set. Please assign the hunting area node in the editor.");
            return;
        }

        // 레이아웃 업데이트 대기 후 초기화 (안전장치)
        this.scheduleOnce(() => {
            this.initHuntingAreaRect();
            this.initialSpawn();
        }, 0.1);
    }

    private initHuntingAreaRect() {
        const huntingAreaNode = this.huntingArea;
        
        // 월드 좌표로 변환할 4개 모서리 준비
        // (anchor가 0.5, 0.5라면 -width/2, width/2로 계산해야 함)
        let w = huntingAreaNode.width;
        let h = huntingAreaNode.height;
        let ax = huntingAreaNode.anchorX;
        let ay = huntingAreaNode.anchorY;

        const p0 = cc.v2(-w * ax, -h * ay); // Bottom-Left
        const p3 = cc.v2(w * (1-ax), h * (1-ay)); // Top-Right

        // 월드 좌표로 변환
        const worldP0 = huntingAreaNode.convertToWorldSpaceAR(p0);
        const worldP3 = huntingAreaNode.convertToWorldSpaceAR(p3);

        // Rect 생성 (min x, min y, width, height)
        // min/max 계산 (회전이 없다고 가정)
        const minX = Math.min(worldP0.x, worldP3.x);
        const minY = Math.min(worldP0.y, worldP3.y);
        const maxX = Math.max(worldP0.x, worldP3.x);
        const maxY = Math.max(worldP0.y, worldP3.y);

        this._huntingAreaWorldRect = new cc.Rect(minX, minY, maxX - minX, maxY - minY);
        
        console.log(`[MonsterManager] Hunting Area Init: ${this._huntingAreaWorldRect}`);
    }

    public setPlayerTarget(player: cc.Node) {
        this.playerNode = player;
    }

    public getHealthBar(): cc.Node {
        if (this.healthBarPool.size() > 0) {
            return this.healthBarPool.get();
        }
        return cc.instantiate(this.healthBarPrefab);
    }

    public putHealthBar(healthBarNode: cc.Node) {
        this.healthBarPool.put(healthBarNode);
    }

    public initialSpawn() {
        for (let i = 0; i < this.maxMonsters; i++) {
            this.spawnMonster();
        }
    }

    public spawnMonster() {
        if (this.activeMonsters.length >= this.maxMonsters) return;
        
        if (!this._huntingAreaWorldRect) { 
            console.warn("[MonsterManager] Hunting Area not ready yet.");
            return; 
        }

        let monsterNode: cc.Node = null;
        if (this.monsterPool.size() > 0) {
            monsterNode = this.monsterPool.get(this);
        } else {
            monsterNode = cc.instantiate(this.monsterPrefab);
        }

        // huntingArea의 경계 계산 (로컬 좌표 기준)
        const halfWidth = this.huntingArea.width / 2;
        const halfHeight = this.huntingArea.height / 2;
        
        // huntingArea 영역 안에서 랜덤 위치 생성 (로컬 좌표)
        const randomX = (Math.random() * this.huntingArea.width) - halfWidth;
        const randomY = (Math.random() * this.huntingArea.height) - halfHeight;
        
        // huntingArea의 로컬 좌표를 월드 좌표로 변환
        const worldPos = this.huntingArea.convertToWorldSpaceAR(cc.v2(randomX, randomY)); // Use cc.v2

        // 월드 좌표를 monsterLayer의 로컬 좌표로 변환
        const finalPos = this.monsterLayer.convertToNodeSpaceAR(worldPos); // Use cc.Node's method
        
        monsterNode.parent = this.monsterLayer;
        monsterNode.position = cc.v3(finalPos.x, finalPos.y, 0);
        
        // 랜덤 속도 계산
        // baseSpeed를 중심으로 variance만큼 퍼짐
        const randomSpeed = this.baseSpeed + (Math.random() - 0.5) * this.speedVariance;

        const monster = monsterNode.getComponent(Monster);
        monster.init(randomSpeed, this.playerNode, this.detectionRange, this._huntingAreaWorldRect);

        this.activeMonsters.push(monsterNode);
    }

    public despawnMonster(monsterNode: cc.Node) {
        const index = this.activeMonsters.indexOf(monsterNode);
        if (index > -1) {
            this.activeMonsters.splice(index, 1);
        }
        
        this.monsterPool.put(monsterNode);

        this.scheduleOnce(this.spawnMonster, 1.0);
    }
}