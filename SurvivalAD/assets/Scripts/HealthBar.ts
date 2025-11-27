const {ccclass, property} = cc._decorator;

@ccclass
export default class HealthBar extends cc.Component {

    @property(cc.Node)
    private foreground: cc.Node = null;

    //체력바의 상태 업데이트
    public updateHealth(currentHp: number, maxHp: number) {
        if (!this.foreground) return;

        const sprite = this.foreground.getComponent(cc.Sprite);
        if (!sprite || sprite.type !== cc.Sprite.Type.FILLED) {
            cc.warn("HealthBar: foreground sprite is not of type FILLED. Cannot update fillRange.");
            return;
        }

        // 체력 비율 계산 (0~1 사이의 값)
        const ratio = Math.max(0, currentHp / maxHp);

        // 체력 비율에 따라 전경(foreground) 바의 fillRange 조절
        sprite.fillRange = ratio;
    }
}
