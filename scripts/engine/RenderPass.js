/**
 * Created by Accipiter Chalybs on 4/5/2017.
 */
class RenderPass
{
    render(){}
}

class ForwardPass extends RenderPass
{
    render(){
        let lightIndex = 0;
        //TODO sort lights by importance?
        for (let l of Renderer.renderBuffer.light) {
            if (lightIndex > Renderer.FORWARD_SHADER_LIGHT_MAX) break;
            l.forwardPass(lightIndex++);
        }

        for (let mesh of Renderer.renderBuffer.forward) {
            if(mesh.material.shader === Renderer.getShader(Renderer.FORWARD_UNLIT) || mesh.material.shader === Renderer.getShader(Renderer.FORWARD_EMISSIVE))
                GL.depthMask(false);

            mesh.material.bind();
            mesh.draw();

            if (mesh.material.shader === Renderer.getShader(Renderer.FORWARD_UNLIT) || mesh.material.shader === Renderer.getShader(Renderer.FORWARD_EMISSIVE))
                GL.depthMask(true);
        }
    }
}

class ParticlePass extends RenderPass
{
    render(){
        for (let mesh of Renderer.renderBuffer.particle) {
            mesh.draw();
        }
    }
}



class ShadowPass extends ForwardPass
{
    render(){
        GL.enable(GL.DEPTH_TEST);
        GL.depthMask(true);
        GL.disable(GL.BLEND);
        GL.enable(GL.CULL_FACE);
        GL.cullFace(GL.BACK);
        GL.disable(GL.STENCIL_TEST);

        for (let l of Renderer.renderBuffer.light) {
            let caster = l; //TODO check if right type of light (this was supposed to check = directional)
            if (!caster || !caster.shadowCaster) continue;
            caster.bindShadowMap();
            GL.drawBuffer([GL.NONE]);
            for (let mesh of Renderer.renderBuffer.deferred) {
                let mat = mesh.material;
                let s = null;
                if (mat.shader === Renderer.getShader(Renderer.DEFERRED_PBR_SHADER_ANIM)) s = Renderer.getShader(Renderer.SHADOW_SHADER_ANIM);
                else s = Renderer.getShader(Renderer.SHADOW_SHADER);
                if (s !== Renderer.currentShader) s.use();
                mesh.draw();
            }
        }
    }
}




///////////////////////////////////
class DeferredPass extends RenderPass
{
    constructor(){
        super();
        this.buffers = new Framebuffer(Renderer.getWindowWidth(), Renderer.getWindowHeight(), 3, false, true, [GL.RGBA8, GL.RGBA16F/*TODO should be RGBA16 - is this ok*/, GL.RGBA16F]);
        this.fbo = new Framebuffer(Renderer.getWindowWidth(), Renderer.getWindowHeight(), 1, false, true, [GL.RGBA16F]);
    }

    render(){
        GL.enable(GL.DEPTH_TEST);
        GL.depthMask(true);
        GL.disable(GL.BLEND);
        GL.enable(GL.CULL_FACE);
        GL.cullFace(GL.BACK);
        GL.disable(GL.STENCIL_TEST);

        let buffers = [ GL.COLOR_ATTACHMENT0, GL.COLOR_ATTACHMENT1, GL.COLOR_ATTACHMENT2 ];
        this.buffers.bind(buffers);
        for(let mesh of Renderer.renderBuffer.deferred)
        {
            mesh.material.bind();
            mesh.draw();
        }



        Renderer.getShader(Renderer.DEFERRED_SHADER_LIGHTING).use();
        let screenSize = vec2.create(); vec2.set(screenSize, Renderer.getWindowWidth(), Renderer.getWindowHeight());
        Renderer.getShader(Renderer.DEFERRED_SHADER_LIGHTING).setUniform("uScreenSize", screenSize, UniformTypes.vec2);
        GL.depthMask(false);
        GL.stencilOpSeparate(GL.BACK, GL.KEEP, GL.INCR_WRAP, GL.KEEP);
        GL.stencilOpSeparate(GL.FRONT, GL.KEEP, GL.DECR_WRAP, GL.KEEP);


        GL.bindFramebuffer(GL.FRAMEBUFFER, this.fbo.id);
        GL.drawBuffers([GL.COLOR_ATTACHMENT0]); //switch to rendering output, but keep depth from earlier
        GL.clear(GL.COLOR_BUFFER_BIT);
        GL.bindFramebuffer(GL.READ_FRAMEBUFFER, this.buffers.id);
        GL.blitFramebuffer(0, 0, this.fbo.width, this.fbo.height,
          0, 0, this.fbo.width, this.fbo.height,
                            GL.DEPTH_BUFFER_BIT,
                            GL.NEAREST);
        GL.bindFramebuffer(GL.READ_FRAMEBUFFER, null);


        this.buffers.bindTexture(0, 0);
        this.buffers.bindTexture(1, 1);
        this.buffers.bindTexture(2, 2);

        Renderer.getShader(Renderer.DEFERRED_SHADER_LIGHTING).setUniform("uIV_Matrix", Renderer.camera.gameObject.transform.getTransformMatrix(), UniformTypes.mat4);

        for(let light of Renderer.renderBuffer.light) {
            let d = light; //TODO check if directional light
            if (!d || true)
            {
                GL.drawBuffers([GL.NONE]);
                GL.disable(GL.CULL_FACE);
                GL.enable(GL.STENCIL_TEST);
                GL.enable(GL.DEPTH_TEST);
                GL.clear(GL.STENCIL_BUFFER_BIT);
                GL.stencilFunc(GL.ALWAYS, 0, 0);

                light.deferredPass(true);


                GL.stencilFunc(GL.NOTEQUAL, 0, 0xFF);
                GL.cullFace(GL.FRONT);
            }
            else
            {
                GL.cullFace(GL.BACK);
                GL.disable(GL.STENCIL_TEST);
                if(d.shadowCaster && d.fbo)
                {
                    d.fbo.bindDepthTexture(3);
                    //TODO is this the right inverse?
                    //TODO change to our js method of assigning uniforms Renderer.getShader(Renderer.DEFERRED_SHADER_LIGHTING)["uShadow_Matrix"] = DeferredPass.bias * DirectionalLight.shadowMatrix * mat4.inverse(d.gameObject.transform.getTransformMatrix());
                }
            }

            GL.enable(GL.BLEND);
            GL.blendEquation(GL.FUNC_ADD);
            GL.blendFunc(GL.ONE, GL.ONE);
            GL.enable(GL.CULL_FACE);
            GL.disable(GL.DEPTH_TEST);
            GL.drawBuffers([GL.COLOR_ATTACHMENT0]); //switch back to main image

            light.deferredPass(false);
        }
        GL.disable(GL.STENCIL_TEST);
        GL.disable(GL.DEPTH_TEST);
        GL.disable(GL.CULL_FACE);


        let currentEntry = Mesh.prototype.meshMap["Plane"];

        if (Renderer.gpuData.vaoHandle !== currentEntry.vaoHandle) {
            GL.bindVertexArray(currentEntry.vaoHandle);
            Renderer.gpuData.vaoHandle = currentEntry.vaoHandle;
        }

        Renderer.currentShader.setUniform("uLightType", 3, UniformTypes.u1i);
        Renderer.currentShader.setUniform("uScale", 1, UniformTypes.u1f);
        Renderer.currentShader.setUniform("uLightPosition", vec3.create(), UniformTypes.vec3);
        Renderer.currentShader.setUniform("uV_Matrix", mat4.create(), UniformTypes.mat4);
        Renderer.currentShader.setUniform("uP_Matrix", mat4.create(), UniformTypes.mat4);
        GL.drawElements(GL.TRIANGLES, currentEntry.indexSize, GL.UNSIGNED_SHORT, 0);
        Renderer.currentShader.setUniform("uV_Matrix", Renderer.camera.getCameraMatrix(), UniformTypes.mat4); //TODO is this one needed?
        Renderer.currentShader.setUniform("uP_Matrix", Renderer.perspective, UniformTypes.mat4);


        // TODO : Render Ambient
        GL.enable(GL.DEPTH_TEST);
        GL.enable(GL.CULL_FACE);
        GL.depthMask(true);
        GL.cullFace(GL.BACK);
        GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
    }
}

DeferredPass.prototype.bias = mat4.create(
    0.5, 0.0, 0.0, 0.0,
    0.0, 0.5, 0.0, 0.0,
    0.0, 0.0, 0.5, 0.0,
    0.5, 0.5, 0.5, 1.0);

class SkyboxPass extends RenderPass
{
    constructor(skybox){
        super();
        this.skybox = skybox;
    }

    render(){
        if (this.skybox && this.skybox !== null) { this.skybox.draw(); }
    }
}





////////////////////////////////
class BloomPass extends RenderPass
{
    constructor(deferred){
        super();
        this._deferredPass = deferred;

        this.averageExposure = 1;
        this._averageSize = 16;

        let screenWidth = Renderer.getWindowWidth();
        let screenHeight = Renderer.getWindowHeight();

        this._averagePass = new Framebuffer(this._averageSize, this._averageSize, 1, false, true);

        this._brightPass = new Framebuffer(screenWidth, screenHeight, 1, false, true);
        this._blurBuffers = [];
        this._blurBuffers[0] = [new Framebuffer(screenWidth  / 2, screenHeight / 2, 1, false, true),
                                 new Framebuffer(screenWidth  / 2, screenHeight / 2, 1, false, true)];
        this._blurBuffers[1] = [new Framebuffer(screenWidth / 4, screenHeight / 4, 1, false, true),
                                 new Framebuffer(screenWidth / 4, screenHeight / 4, 1, false, true)];
        this._blurBuffers[2] = [new Framebuffer(screenWidth/ 8, screenHeight / 8, 1, false, true),
                                 new Framebuffer(screenWidth/ 8, screenHeight / 8, 1, false, true)];
        this._blurBuffers[3] = [new Framebuffer(screenWidth / 16, screenHeight / 16, 1, false, true),
                                 new Framebuffer(screenWidth / 16, screenHeight / 16, 1, false, true)];
        this._blurBuffers[4] = [new Framebuffer(screenWidth / 32, screenHeight / 32, 1, false, true),
                                 new Framebuffer(screenWidth / 32, screenHeight / 32, 1, false, true)];
    }
    
    render() {
        let s1 = Renderer.getShader(Renderer.FBO_PASS);
        let s2 = Renderer.getShader(Renderer.FBO_BLUR);
        let s3 = Renderer.getShader(Renderer.FBO_HDR);
        let s4 = Renderer.getShader(Renderer.FBO_AVERAGE);
        this._deferredPass.fbo.unbind();

        let buffers = [ GL.COLOR_ATTACHMENT0, GL.COLOR_ATTACHMENT1, GL.COLOR_ATTACHMENT2, GL.COLOR_ATTACHMENT3 ];

        this._deferredPass.fbo.bindTexture(0, 0); //TODO use (0, 3)
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_NEAREST);
        GL.generateMipmap(GL.TEXTURE_2D);

        //Calculate Average Exposure for Eye Adjustment
        //(Have to render again to get highest mipmap since WebGL doesn't have getTexImage)
        const newDataWeight = 0.05;
        this._averagePass.bind([buffers[0]]);
        s4.use();
        this._deferredPass.fbo.draw();
        let currentRGB = new Float32Array(this._averageSize * this._averageSize * 4);
        GL.readPixels(0, 0, this._averageSize, this._averageSize, GL.RGBA, GL.FLOAT, currentRGB);
        let lumen = 0;

        for (let x=0; x<currentRGB.length; ++x) {
            if (isNaN(currentRGB[x])) {
                Debug.error("err" + x);
                currentRGB[x] = 1;
            }
        }

        for (let i=0; i<this._averageSize * this._averageSize; ++i) {
            lumen+=Math.sqrt(currentRGB[4*i]*currentRGB[4*i] + currentRGB[4*i+1]*currentRGB[4*i+1] + currentRGB[4*i+2]*currentRGB[4*i+2]);
        }
        lumen /= this._averageSize*this._averageSize;

        if (!isNaN(lumen)) {
            this.averageExposure = this.averageExposure * (1 - newDataWeight) + lumen * (newDataWeight);
        }
        //-----------------------------------------------------

        this._brightPass.bind([buffers[0]]);
        s1.use();
        this._deferredPass.fbo.draw();


        this._brightPass.unbind();
        s2.use();
        this._brightPass.bindTexture(0, 0);
        GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_NEAREST);
        GL.generateMipmap(GL.TEXTURE_2D);


        for (let i = 0; i < 5; i++)
        {
            s2.setUniform("level", i + 1, UniformTypes.u1f);
            s2.setUniform("width", (Renderer.getWindowWidth() / Math.pow(2, i + 1)), UniformTypes.u1f);
            s2.setUniform("height", (Renderer.getWindowHeight() / Math.pow(2, i + 1)), UniformTypes.u1f);
            this._brightPass.bindTexture(0, 0);
            this._blurBuffers[i][0].bind([buffers[0]]);
            s2.setUniform("direction", new Float32Array([1, 0]), UniformTypes.vec2);
            this._deferredPass.fbo.draw();

            s2.setUniform("level", 0, UniformTypes.u1f);
            this._blurBuffers[i][0].bindTexture(0, 0);
            this._blurBuffers[i][1].bind([buffers[0]] );
            s2.setUniform("direction", new Float32Array([0, 1]), UniformTypes.vec2);
            this._deferredPass.fbo.draw();
        }
        this._blurBuffers[4][1].unbind();
        s3.use();

        this._deferredPass.fbo.bindTexture(0, 0); //TODO switch to (0, 3)
        this._blurBuffers[0][1].bindTexture(1, 0);
        this._blurBuffers[1][1].bindTexture(2, 0);
        this._blurBuffers[2][1].bindTexture(3, 0);
        this._blurBuffers[3][1].bindTexture(4, 0);
        this._blurBuffers[4][1].bindTexture(5, 0);
        s3.setUniform("inputTex", 0, UniformTypes.u1i);
        s3.setUniform("addTex1", 1, UniformTypes.u1i);
        s3.setUniform("addTex2", 2, UniformTypes.u1i);
        s3.setUniform("addTex3", 3, UniformTypes.u1i);
        s3.setUniform("addTex4", 4, UniformTypes.u1i);
        s3.setUniform("addTex5", 5, UniformTypes.u1i);

        s3.setUniform("exposure", this.averageExposure, UniformTypes.u1f);

        this._deferredPass.fbo.draw();


      if (Debug.bufferDebugMode) {
        switch (Debug.currentBuffer) {
          case Debug.BUFFERTYPE_PRE:
            this._deferredPass.fbo.blitFramebuffer(0, 0, 0, Renderer.getWindowWidth(), Renderer.getWindowHeight());
            break;
          case Debug.BUFFERTYPE_COLOUR:
            this._deferredPass.buffers.blitFramebuffer(0, 0, 0, Renderer.getWindowWidth(), Renderer.getWindowHeight());
            break;
          case Debug.BUFFERTYPE_NORMAL:
            this._deferredPass.buffers.blitFramebuffer(1, 0, 0, Renderer.getWindowWidth(), Renderer.getWindowHeight());
            break;
          case Debug.BUFFERTYPE_POS:
            this._deferredPass.buffers.blitFramebuffer(2, 0, 0, Renderer.getWindowWidth(), Renderer.getWindowHeight());
            break;
          case Debug.BUFFERTYPE_BLOOM:
            let abc = 0;
            for (let i = 0; i < 5; i++) {
              this._blurBuffers[i][1].blitFramebuffer(0, abc, 0, (Renderer.getWindowWidth() / Math.pow(2, i + 1)), (Renderer.getWindowHeight() / Math.pow(2, i + 1)));
              abc += (Renderer.getWindowWidth() / Math.pow(2, i + 1));
            }
            this._averagePass.blitFramebuffer(0, 0, 450, 50, 50);
            break;
          default:
            break;
        }
      }


        // Debug code - enable and disable anti-aliasing to see results of intermediate blur buffers.
        if (Debug.bufferDebugMode) {
            if (Debug.currentBuffer === Debug.BUFFERTYPE_BLOOM) {
            }
        }
    }
}