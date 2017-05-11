// const REGULAR_SPEED = 4;
// const WALK_SPEED = 2;
// const SING_SPEED = 0.8;
// const PLAYER_ACCELERATION = 4;
// const COOLDOWN_SINGING = 0.1;   // In seconds

class DoorEvent extends Event{
  constructor(){
    super();
    // this.movementSpeed = REGULAR_SPEED;
    this.setCurrentState(EventState.uncharged);
    this._unlocked = false;
  }

  start(){
    this._collider = this.transform.gameObject.getComponent("Collider");
    //this._singer = this.transform.gameObject.getComponent("Sing");
    this._collider.setPhysicsMaterial(PhysicsEngine.materials.basicMaterial);
    this._collider.setFreezeRotation(true);
  }

  startClient(){
    // this._singingSrc = this.transform.gameObject.getComponent("AudioSource");
  }

  updateComponent(){
    if (this._unlocked)
    {
     super.updateComponent();
    }
  }

  onUncharged(){

  }

  onCharged(){

  }

  onDischarging(){
    this.transform.position[1] = Utility.moveTowards(this.transform.position[1], 0, Time.deltaTime);
    if (this.transform.position[1] === 0) {
      this.setCurrentState(EventState.uncharged);
    }
  }

  onCharging(){
    this.transform.position[1] = Utility.moveTowards(this.transform.position[1], 2, Time.deltaTime);
    if (this.transform.position[1] === 2) {
      this.setCurrentState(EventState.charged);
    }
  }

  onRaycast(interactingObj){
    let pController = interactingObj.getComponent('PlayerController');
    if (!this._unlocked && pController && pController !== null && pController.keys > 0) {
      let audio = this.gameObject.getComponent("AudioSource");
      if(audio && audio!==null) audio.setState(AudioState.play2dSound);
      this._unlocked = true;
      pController.keys--; //Becareful in future here is HACK what if has lots of keys
      interactingObj.transform.children.splice(0,1);
    }
  }

}