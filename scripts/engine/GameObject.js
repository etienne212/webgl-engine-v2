/**
 * Created by Accipiter Chalybs on 4/5/2017.
 */

class GameObject {
    static findByName(name) {
        return GameObject._nameMap[name];
    }
    static findAllByName(name) {}
    static updateScene() {
        GameObject.SceneRoot.update();
        //TODO: do we need scene.loop?
    }
    constructor() {
        this.components = []; //NOTE: associative map, so use "in" for iteration
        this.name = '';

        this.transform = new Transform();
        this.transform.gameObject = this;


        this.dead = false;
        this.visible = true;
    }

    draw() {
        if (visible) {
            for (let component in this.components) {
                if (component.visible) {
                    component.draw();
                }
            }
            for (let child of this.transform.children) {
                child.gameObject.draw();
            }
        }
    }

    update() {
        for (let i=0; i < this.transform.children.size(); ++i) {
            let object = this.transform.children[i];
            if (object.gameObject.dead) {
                let collider = this.getComponent("BoxCollider");
                if (collider!==null) {
                    collider.remove();
                }
                object.gameObject.delete();
                this.transform.children.splice(i, 1);
            } else {
                object.gameObject.update();
            }
        }

        for (let component in  this.components)
        {
            component.update();
        }
    }

    delete() {
        for (let child of this.transform.children) {
            if (child && child.gameObject) child.gameObject.delete();
        }
        for (let comp in this.components) {
            //TODO add if needed:
            // if (comp) comp.delete();
        }
        this._removeName();
    }

    addComponent(type, component) {
        this.removeComponent(type);
        component.gameObject = this;
        this.components[type] = component;
    }

    //TODO look over this one
    removeComponent(type) {
        delete this.components[type];

        //TODO add if needed:
        // if (comp) comp.delete();
    }

    getComponent(type) {
        return this.components[type];
    }

    addChild(gameObject) {
        this.transform.children.push(gameObject.transform);
        gameObject.transform.parent = this.transform;
    }

    isChildOf(gameObject) {
        let parent = this.transform.parent;
        while (parent !== null) {
            if (parent.gameObject === go) return true;
            parent = parent.parent;
        }
        return false;
    }

    onCollisionEnter(other) {
        for (let comp in this.components) {
            comp.onCollisionEnter(other);
        }
    }

    setName(name) {
        this._removeName();
        //TODO ensure name isn't taken (or switch to array)
        GameObject.prototype._nameMap[name] = this;
    }

    getName() {
        return this.name;
    }

    destroy() {
        this.dead = true;
    }

    hideAll() {
        let mesh = getComponent("Mesh");
        if (mesh && mesh !== null) mesh.visible = false;

        //Particle trail component too


        for (let child of this.transform.children) {
            child.gameObject.hideAll();
        }

    }

    extract() {
        if (visible) {
            let mesh = this.getComponent("Mesh");
            if (mesh !== null) {
                if (mesh.material && mesh.material.transparent) {
                    Renderer.renderBuffer.forward.push(mesh);
                }
                else if(mesh.material)
                {
                    Renderer.renderBuffer.deferred.push(mesh);
                }
            }
            /*
            GPUEmitter* emitter;
            if ((emitter = getComponent<GPUEmitter>()) != nullptr) {
                Renderer::renderBuffer.particle.push_back(emitter);
            }
            ParticleTrail* trail;
            if ((trail = getComponent<ParticleTrail>()) != nullptr) {
                Renderer::renderBuffer.particle.push_back(trail);
            }
            */
            let light = this.getComponent("Light");
            if (light !== null) {
                Renderer.renderBuffer.light.push(light);
            }
        }

        for (let child of this.transform.children) {
            child.gameObject.extract();
        }
    }

    setMaterial(mat) {
        let mesh = this.getComponent("Mesh");
        if (mesh && mesh !== null) {
            mesh.setMaterial(mat);
        }

        //TODO should we really set children too?
    }

    _removeName()
    {
        //TODO note, this currently means no duplicate names
        delete GameObject.prototype._nameMap[this.name];
    }

}

GameObject.prototype._nameMap = {};
GameObject.prototype.SceneRoot = null;