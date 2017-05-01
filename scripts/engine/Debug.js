/**
 * Created by Accipiter Chalybs on 4/13/2017.
 */

let Debug = {};

Debug.clientUpdate = false; //Run the client in standalone mode, so it doesn't need a server - good for testing!
Debug.bufferDebugMode = true; //Sets the OpenGL Context to not use MSAA, so that buffers can be blitted to the screen
Debug.debugDisplay = false;


Debug.start = function() {
  if (Debug.debugDisplay) {
    document.getElementById("debugContainer").style.display = "block";
    if (Debug.fpsElement === null) Debug.fpsElement = document.getElementById("fpsCounter");
  }
};

Debug.update = function() {
  if (Debug.debugDisplay) {
    Debug.logFPS();
  }

  if (Debug.bufferDebugMode) {
    if (Input.getAxis("debugButtonBuffer")) {
      Debug.currentBuffer =(Debug.currentBuffer + 1) % Debug.bufferTypeCount;
    }
  }
};

Debug.bufferTypeCount = 6;
Debug.BUFFERTYPE_NONE = 0;
Debug.BUFFERTYPE_PRE = 1;
Debug.BUFFERTYPE_COLOUR = 2;
Debug.BUFFERTYPE_NORMAL = 3;
Debug.BUFFERTYPE_POS = 4;
Debug.BUFFERTYPE_BLOOM = 5;
Debug.currentBuffer = Debug.BUFFERTYPE_PRE;


Debug.fpsElement = null;
Debug.lastTime=-1;
Debug.frames=0;
Debug.logFPS = function() {
  if (Debug.lastTime === -1) Debug.lastTime = new Date().getTime();
  Debug.frames++;
  let current = new Date().getTime();
  let duration = (current - Debug.lastTime) / 1000.0;
  if (duration >= 1) {
    console.log(Debug.frames);
    let fpsString = "FPS: " + Math.floor(Debug.frames/duration);
    Debug.fpsElement.innerText = fpsString;

    Debug.frames = 0;
    Debug.lastTime = current;
  }
};


//Go through Debug, so easier to find and remove;
Debug.log = console.log;
Debug.error = console.error;

Debug.assert = function(shouldBeTrue) {
  if (shouldBeTrue === false) {
    throw new Error("Assertion Failed");
  }
};

Debug._timer = 0;
Debug.startTimer = function () {
  Debug._timer = new Date().getTime();
};

Debug.getTimerDuration = function(name) {
  let duration = new Date().getTime() - Debug._timer;
  console.log(name + " " + duration);
  return duration;
};

// Debugging bools for collision
Debug.collision = {};
Debug.collision.printInfo = false;
Debug.collision._infoTypes = {all: "all", triggerOnly: "triggerOnly", nonTriggerOnly: "nonTriggerOnly"}; // 'all' is default
Debug.collision._currInfoType = Debug.collision._infoTypes.all;

Debug.printCollisionInfo = function(collisionEvent, gameObject, isTrigger){
  switch(Debug.collision._currInfoType){
    case Debug.collision._infoTypes.triggerOnly:
      if(isTrigger){
        console.log("TRIGGER event. (" + gameObject.name + ")");
        console.log("\tCollided with body:", collisionEvent.body);
        console.log("\tContact between bodies:", collisionEvent.contact);
      }
      break;
    case Debug.collision._infoTypes.nonTriggerOnly:
      if(!isTrigger){
        console.log("COLLISION event. (" + gameObject.name + ")");
        console.log("\tCollided with body:", collisionEvent.body);
        console.log("\tContact between bodies:", collisionEvent.contact);
      }
      break;
    default:
      if(isTrigger)
        console.log("TRIGGER event. (" + gameObject.name + ")");
      else
        console.log("COLLISION event. (" + gameObject.name + ")");

      console.log("\tCollided with body:", collisionEvent.body);
      console.log("\tContact between bodies:", collisionEvent.contact);
      break;
  }
};
