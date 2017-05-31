/**
 * Created by Stephen on 4/18/2017.
 */

class CompoundCollider extends Collider{
  constructor({mass = 0, trigger = false, scaleX = 1, scaleY = 1, scaleZ = 1}){
    super({mass: mass, trigger: trigger});

    this.scaleX = scaleX;
    this.scaleY = scaleY;
    this.scaleZ = scaleZ;
  }

  addShape (type, size, offset) {
    //TODO this likely won't work if the parent has a rotation
    // vec3.transformQuat(offset, offset,
    //   quat.rotateX(this.rotation, this.rotation, theta););
    //this.gameObject.addChild(Debug.drawTeapot(vec3.add(vec3.create(),vec3.create(), offset), vec4.fromValues(1, 1, 0,1)));

    let objScale = (!this.transform.getParent()) ? 1 : this.transform.getParent().getScale()[0];
    if (type === "box") {
      let halfExtents = new CANNON.Vec3(objScale * size[0]*0.5,objScale * size[1]*0.5, objScale * size[2]*0.5);
      let boxShape = new CANNON.Box(halfExtents);
      this.body.addShape(boxShape, new CANNON.Vec3(objScale * offset[0], objScale * offset[1], objScale * offset[2]));
    } else if (type === "sphere") {
      Debug.assert(size[0] === size[1] && size[0] === size[2]);
      let radius = objScale * size[0];
      let sphereShape = new CANNON.Sphere(radius);
      this.body.addShape(sphereShape, new CANNON.Vec3(objScale * offset[0], objScale * offset[1], objScale * offset[2]));
    }

    let debugTeapot = Debug.drawCollider(type, vec3.fromValues(objScale * offset[0], objScale * offset[1], objScale * offset[2]),
      vec4.fromValues(1, 1, 0,1));
    if (debugTeapot === null) return;

    debugTeapot.transform.translate(this.transform.getWorldPosition());
    debugTeapot.transform.setRotation(this.transform.getWorldRotation());
    debugTeapot.isStatic = true;
    debugTeapot.transform.scaleFactor = vec3.fromValues(objScale * size[0],objScale * size[1], objScale * size[2]);
    GameObject.prototype.SceneRoot.addChild(debugTeapot);
  }
}