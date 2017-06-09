class TutorialDontsingEvent extends TriggerEvent {
  constructor() {
    super();
    this.triggerBool = false;
    this.alreadyTriggered = false;

    this.name = 'dontsing';
  }

  updateComponentClient() {
    if (this.triggerBool&& !this.alreadyTriggered) {
      this.alreadyTriggered = true;

      displayTutorialBanner(this.name);
      window.setTimeout(
        displayTutorialBanner.bind(null, this.name, false),
        5000
      );
    }

  }

  triggered() {
    this.triggerBool = true;
  }
}
