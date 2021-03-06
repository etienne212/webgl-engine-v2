/**
 * Created by Accipiter Chalybs on 4/14/2017.
 */

class RotateOverTime extends Component {
    constructor(speed) {
        super();
        this.componentType = "RotateOverTime";
        this.speed = speed;
    }

    update() {
        let dr = quat.create();
        let up = vec3.create(); vec3.set(up, 0, 1, 0);
        quat.setAxisAngle(dr, up, Time.deltaTime * 0.1 * this.speed);
        this.transform.rotate(dr);
    }
}
