import PlayerController from "./PlayerController";
import GameManager from "./GameManager";

const {ccclass, property} = cc._decorator;

@ccclass
export default class UpgradeZone extends cc.Component {

    @property
    requiredItems: number = 10;

    @property
    detectionRadius: number = 200;

    @property(cc.ParticleSystem)
    successParticle: cc.ParticleSystem = null;

    // 진행 상황을 표시할 라벨
    @property(cc.Label)
    progressLabel: cc.Label = null;

    private currentItems: number = 0;
    private consumeTimer: number = 0;
    private player: PlayerController = null;
    private debugGraphics: cc.Graphics = null;

    start () {
        if (this.successParticle) {
            this.successParticle.stopSystem();
            this.successParticle.node.active = false;
        }

        // 시작할 때 라벨 텍스트 초기화 "0 / 10"
        this.updateProgressLabel();

        //this.createDebugGraphics();
    }

    createDebugGraphics() {
        let debugNode = new cc.Node("DebugZoneRange");
        debugNode.parent = this.node;
        debugNode.setPosition(0, 0);
        debugNode.zIndex = -1; 

        this.debugGraphics = debugNode.addComponent(cc.Graphics);
        this.debugGraphics.lineWidth = 5;
        this.debugGraphics.strokeColor = cc.Color.YELLOW;
        this.debugGraphics.circle(0, 0, this.detectionRadius);
        this.debugGraphics.stroke();
    }

    // 라벨 텍스트 업데이트 함수
    updateProgressLabel() {
        if (this.progressLabel) {
            this.progressLabel.string = `${this.currentItems} / ${this.requiredItems}`;
            
            // 텍스트가 살짝 튀어오르는 연출 추가 (타격감)
            this.progressLabel.node.stopAllActions();
            this.progressLabel.node.scale = 1.5;
            cc.tween(this.progressLabel.node)
                .to(0.1, { scale: 1.0 }, { easing: 'backOut' })
                .start();
        }
    }

    update(dt: number) {
        if (!this.player && GameManager.instance && GameManager.instance.playerInstance) {
            this.player = GameManager.instance.playerInstance.getComponent(PlayerController);
        }

        if (!this.player) return;

        let myWorldPos = this.node.convertToWorldSpaceAR(cc.v2(0, 0));
        let playerWorldPos = this.player.node.convertToWorldSpaceAR(cc.v2(0, 0));
        
        let myPos2D = cc.v2(myWorldPos.x, myWorldPos.y);
        let playerPos2D = cc.v2(playerWorldPos.x, playerWorldPos.y);
        let dist = myPos2D.sub(playerPos2D).mag();

        if (dist <= this.detectionRadius) {
            if (this.player.itemStack.length > 0 && this.currentItems < this.requiredItems) {
                this.consumeTimer += dt;
                if (this.consumeTimer > 0.1) { 
                    this.consumeItem();
                    this.consumeTimer = 0;
                }
            }
        }
    }

    consumeItem() {
        if (!this.player) return;
        let item = this.player.popItem();
        if (!item) return;

        let worldPos = item.parent.convertToWorldSpaceAR(item.position);
        item.parent = this.node;
        let localPos = this.node.convertToNodeSpaceAR(worldPos);
        item.setPosition(localPos);

        cc.tween(item)
            .to(0.3, { position: cc.v3(0, 0, 0), scale: 0.5 }, { easing: 'backIn' })
            .call(() => {
                GameManager.instance.itemManager.despawnItem(item); 
                this.currentItems++;
                
                // 아이템이 들어갔으니 라벨 갱신
                this.updateProgressLabel();
                
                this.checkUpgrade();
            })
            .start();
    }

    checkUpgrade() {
        if (this.currentItems >= this.requiredItems) {
            console.log("UPGRADE COMPLETE!");
            if (this.player) {
                this.player.attackDamage += 5;
            }
            
            // 초기화
            this.currentItems = 0;

            // 다음 단계 요구량 5 증가
            this.requiredItems += 5;
            
            // 라벨 업데이트
            this.updateProgressLabel();

            cc.tween(this.node)
                .to(0.1, { scale: 1.2 })
                .to(0.1, { scale: 1.0 })
                .start();

            if (this.successParticle) {
                this.successParticle.node.active = true;
                this.successParticle.resetSystem();
                
                this.successParticle.node.scale = 0.5;
                cc.tween(this.successParticle.node)
                    .to(0.3, { scale: 1.5 }, { easing: 'backOut' })
                    .start();
            }
        }
    }
}
