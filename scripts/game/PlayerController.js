/**
 * Created by Stephen on 4/15/2017.
 */

const REGULAR_SPEED = 4;
const WALK_SPEED = 2;
const SING_SPEED = 0.8;
const PLAYER_ACCELERATION = 4;
const CHAR_NAME = "CAIN"; // CUZ I GOT 1 KEY and 0 bombs
const COOLDOWN_SINGING = 0.1;   // In seconds
const TIME_TO_RESPAWN = 3;

const HATE_SING = 1;

const PlayerState = {
  default: "default",
  walking: "walking",
  singing: "singing",
  noControl: "noControl",
  cantMove: "cantMove",
  dead: "dead"
};

// Requires a collider, sing
class PlayerController extends Component {
  constructor({injured}){
    super();
    // init
    this._looker = null;

    // space
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.forward = vec3.create(); vec3.set(this.forward, 0, 0, -1);
    this.cameraPos = vec3.create(); vec3.set(this.cameraPos, 0, 0, -1);

    // input
    this.singing = 0;
    this.walking = 0;
    this.action = 0;

    // physics
    this._colliders = [];
    this._collider = null;

    // singing
    this._singer = null;
    this._singingSrc = null;
    this._nextSingTime = 0;
    this._lastSingInput = 0;
    this._singingCooldown = COOLDOWN_SINGING;
    this._respawnTime = 0;

    // game state
    this.state = new PlayerLogicState();
    this.state.status = PlayerState.default;
    this.keys = 0;
    this.injured = false;
    this.checkpoint = null;

    // meta
    this.componentType = 'PlayerController';
  }

  start() {
    // object refs
    this._singer = this.transform.gameObject.getComponent('Sing');
    this._looker = this.transform.gameObject.getComponent("Look");

    // physics init
    this.transform.gameObject.getComponent('Collider').setLayer(FILTER_PLAYER);
    this.transform.gameObject.findComponents('Collider', this._colliders);
    for(let i = 0; i < this._colliders.length; ++i) {
      this._colliders[i].setPhysicsMaterial(PhysicsEngine.materials.playerMaterial);
      this._colliders[i].setFreezeRotation(true);
    }

    // game state
    this.checkpoint = this.transform.getWorldPosition();

    // network
    this.gameObject.addComponentToSerializeableList(this);

    // start anim
    this.state.start(this.gameObject);
  }

  startClient(){
    this.gameObject.addComponentToSerializeableList(this);
    this._singingSrc = this.transform.gameObject.getComponent('AudioSource');
  }

  updateComponentClient(){
  }

  updateComponent(){
    if(this.getCurrentState() === PlayerState.dead){
      Debug.log('INSIDE DEAD');
      if(Time.time > this._respawnTime){
        this.respawn();
      }
      return;
    }
    if(this.getCurrentState() === PlayerState.noControl)
      return;

    // Add if loop to enable client side testing w/o server
    if (Debug.clientUpdate && !IS_SERVER) {
      this.x = Input.getAxis('horizontal');
      this.z = Input.getAxis('vertical');
      this.walking = Input.getAxis('walk');
      this.singing = Input.getAxis('sing');
      this.action = Input.getAxis("action");

      this.forward = Renderer.camera.transform.getForward();
      this.cameraPos = Renderer.camera.transform.getWorldPosition();
    }

    if (this.singing === 0 && this._lastSingInput === 1) {
      this._nextSingTime = Time.time + this._singingCooldown;
    }

    this._lastSingInput = this.singing;

    if (this.state.status === PlayerState.cantMove){

    } else if (!this.injured && this.singing === 1 && Time.time >= this._nextSingTime) {
      this.state.status = PlayerState.singing;
      //if !injured

      // if(!IS_SERVER) this._singingSrc.resumeSound();
    } else if (this.walking === 1) {
      this.state.status = PlayerState.walking;
    } else {
      this.state.status = PlayerState.default;
    }

    if(this.state.status !== PlayerState.cantMove) {
      this.movement();
    }

    if(this.state.status === PlayerState.singing) {
      PlayerTable.increaseHate(PlayerTable.currentPlayer, HATE_SING);
      this._singer.sing();
    }else{
      this._singer.quiet();
    }

    if(this.action === 1) {
      this._looker.look();
    }

    this.state.update();
  }


  movement(){
    if(this.state.status === PlayerState.singing) {
      this.state.moveSpeed = Utility.moveTowards(this.state.moveSpeed, SING_SPEED, 4 * PLAYER_ACCELERATION * Time.deltaTime);
    } else if(this.state.status === PlayerState.walking) {
      this.state.moveSpeed = Utility.moveTowards(this.state.moveSpeed, WALK_SPEED, PLAYER_ACCELERATION * Time.deltaTime);
    } else if(this.state.status === PlayerState.default) {
      this.state.moveSpeed = Utility.moveTowards(this.state.moveSpeed, 0.001, PLAYER_ACCELERATION * Time.deltaTime);
    }

    let up = vec3.create(); vec3.set(up, 0, 1, 0);
    let move = vec3.create();
    let moveX = vec3.create(); vec3.cross(moveX, this.forward, up);
    let moveZ = vec3.create(); vec3.cross(moveZ, up, moveX);
    vec3.normalize(moveX, moveX);
    vec3.normalize(moveZ, moveZ);
    vec3.scale(moveX, moveX, this.x * this.state.moveSpeed);
    vec3.scale(moveZ, moveZ, this.z * this.state.moveSpeed);
    vec3.add(move, moveX, moveZ);
    vec3.normalize(move, move);
    vec3.scale(move, move, this.state.moveSpeed);

    if (vec3.length(move) > 0.0005) {
      // TODO set this.state.movedot and movecrossy instead
      this.transform.setRotation(quat.create());
      this.transform.rotateY(Math.atan2(-move[2], move[0]) - Math.PI / 2);
    }
  }

  heal(){
    // Debug.log("Healed");
    this.injured = false;
  }

  takeDamage(){
    if(this.injured === true && this.getCurrentState() !== PlayerState.dead){
      this.die();
      return;
    }

    Debug.log("ow");

    this.injured = true;
  }

  die(){
    Debug.log("I die.");
    this.setCurrentState(PlayerState.dead);
    this._respawnTime = Time.time + TIME_TO_RESPAWN;
  }

  respawn(){
    // Debug.log("respawned at ", this.checkpoint);
    this.transform.setWorldPosition(this.checkpoint);
    this._collider.body.position.set(this.checkpoint[0], this.checkpoint[1], this.checkpoint[2]);
    this.setCurrentState(PlayerState.default);
    this.injured = false;
  }


  getCurrentState() {
    return this.state.status;
  }

  setCurrentState(newState) {
    this.state.status = newState;
  }

  // eg slide, happens once
  triggerAnimation(animState) {
    this.state.setTrigger(animName);
  }

  serialize() {
    const data = {
      a: this.action,
      s: this.singing,
      st: this._nextSingTime,
      i: this.injured,
      k: this.keys,
    };
    return data;
  }

  applySerializedData(data) {
    // Debug.log(this);
    this.action = data.a;
    this.singing = data.s;
    this._nextSingTime = data.st;
    this.injured = data.i;
    this.keys = data.k;
  }
}