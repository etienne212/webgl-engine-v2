#version 300 es
precision mediump float;
in vec4 vPosition;
in vec3 vNormal;
in vec2 vTexCoord;
in vec3 vTangent;
in vec3 vBitangent;

layout(location = 0) out vec4 frag_color;
layout(location = 1) out vec4 frag_normal;
layout(location = 2) out vec4 frag_material;

const float PI = 3.14159265359;

const int sample_count = 1; //number of times to sample the cubemap for specular lighting

uniform mat4 irradiance[3]; //matrices from the calculated SH corresponding to the env. diffuse lighting for r, g, and b.

uniform sampler2D colorTex; //color texture - rgb: color | a: team mask
uniform sampler2D matTex; //material texture - r: metalness | g: IOR | b: roughness | a: unused
uniform sampler2D normalTex; //normal texture - rgb: normal | a: unused
uniform sampler2D shadowTex; //directional light distance texture
uniform samplerCube environment; //the environment cubemap to sample reflections from

uniform float environment_mipmap; //the number of mipmaps the environment map has (used to select mipmap based on roughness)

//world space camera position, to get view vector
uniform vec3 cameraPos;

//light data - (position.xyz, unused) followed by (lightColor.xyz, lightType)
const int lightCount = 5;
uniform vec4 uLightData[3*lightCount];
uniform samplerCube shadowCube[lightCount]; //point light distance cubes

uniform mat4 uShadow_Matrix;


float GGX_Visibility(float dotProduct, float k) {
	//return 2.0 / (dotProduct + sqrt(k*k + (1.0 - k*k)*dotProduct*dotProduct)); //More accurate, but slower version

	k=k/2.0;
	return 1.0 / (dotProduct * (1.0 - k) + k);
}

float GGX_D(float dotNH, float a) {
	a = clamp(a, 0.001, 1.0); //prevent a (and a2) from being too close to zero
	float a2 = a*a;
	float bot = (dotNH * dotNH * (a2 - 1.0) + 1.0);
	return (a2) / (PI * bot * bot);
}

vec3 SpecularBRDF(vec3 lightColor, vec3 normal, vec3 view, vec3 lightDir, float a, vec3 F0, float d) {
		vec3 halfVec = normalize(view + lightDir);

		float dotNL = clamp(dot(normal, lightDir), 0.0, 1.0);

		float dotNV = clamp(dot(normal, view), 0.0, 1.0);
		float dotLH = clamp(dot(lightDir, halfVec), 0.0, 1.0);

		vec3 F = F0 + (vec3(1.0, 1.0, 1.0)-F0) * pow(1.0-dotLH, 5.0);

		float k = clamp(a+0.36, 0.0, 1.0);
		float G = GGX_Visibility(dotNV, k)*GGX_Visibility(dotNL, k);

		return lightColor * F * G * dotNL;
}


//generates sample directions, sets up the values, calls the BRDF, then accumulates resulting colors
vec3 SpecularEnvMap(vec3 normal, vec3 view, float a, vec3 F0) {

    vec3 lightDir = reflect(-view, normal);
    vec3 lightColor = textureLod(environment, lightDir, a*environment_mipmap).xyz;

    float dotNL = clamp(dot(normal,lightDir), 0.0, 1.0); //For environment map, we can use NL for Fresnel since using reflect vector

    //Fresnel roughness approximation from https://seblagarde.wordpress.com/2011/08/17/hello-world/
    vec3 F = F0 + (max(vec3(1.0-a, 1.0-a, 1.0-a), F0)-F0) * pow(1.0-dotNL, 5.0);

	return lightColor * F;
}

//Method from https://gamedev.stackexchange.com/questions/56897/glsl-light-attenuation-color-and-intensity-formula
float pointAttenuation(float distance, int i) {
    float ratio = (distance / uLightData[3*i+2].x);
    //TODO should inner value be squared?
    float retVal = clamp(1.0 - ratio * ratio, 0.0, 1.0);
    return retVal * retVal;
}

const vec2 poissonDisk[4] = vec2[](
   vec2( -0.94201624, -0.39906216 ),
   vec2( 0.94558609, -0.76890725 ),
   vec2( -0.094184101, -0.92938870 ),
   vec2( 0.34495938, 0.29387760 )
 );


float textureShadow(float posZ, vec2 uv) {
    return step(posZ, texture(shadowTex, uv).r);
}

float textureShadowCube(float posZ, vec3 dir, int i) {
    float shadowDist = texture(shadowCube[i], normalize(dir)).r;
    return step(posZ, shadowDist);
}


void main () {
  vec4 albedo = texture(colorTex, vTexCoord);
  vec3 mat = texture(matTex, vTexCoord).rgb;

  vec3 normal_tangent = 2.0*texture(normalTex, vTexCoord).rgb - 1.0;
  vec3 normal = normalize(vTangent * normal_tangent.x + vBitangent * normal_tangent.y + vNormal * normal_tangent.z);

  /* For Testing Shader ---
  albedo = vec4(.81,.32,.15,1);
  mat = vec3(0,0,0.1);
  normal = normalize(vNormal);
  */

  vec3 view = normalize(cameraPos - vPosition.xyz);


  mat.b += 0.01; //there seem to be issues with roughness = 0 due to visibility

  //TODO should this be sqrt? or squared?
  float a = sqrt(mat.b);// squaring it makes everything shiny, sqrting it looks like linear roughness

  float IOR = 1.4; //just going to use a nice default for now
  //F0 is essentially specular color, as well as Fresnel term
  vec3 F0 = vec3(1,1,1) * 0.02777777777;//pow((1.0 - IOR) / (1.0 + IOR), 2.0);
  F0 = mix(F0, albedo.rgb, mat.r); //interpolate Fresnel with the color as metalness increases (with metalness=1, color => reflection color)
  F0 = mix(vec3(1,1,1) * dot(vec3(.33,.33,.33),F0), F0, mat.r); //my own improvement - could be wrong : desaturates Fresnel as metalness decreases



  vec4 normal4 = vec4(normal, 1.0);

//TODO readd
/*
  vec3 diffuseLight = vec3(dot(normal4, (irradiance[0] * normal4)),
                           dot(normal4, (irradiance[1] * normal4)),
						   dot(normal4, (irradiance[2] * normal4)) );

  vec3 specColor = SpecularEnvMap(normal, view, a, F0);
*/
vec3 diffuseLight;
vec3 specColor;


  for (int i=0; i < lightCount; ++i) {
	float lightType = uLightData[3*i+1].w;
	float power = 1.0;
	vec3 lightDir;
	vec3 lightDir2;
	float shadow=0.0;
	if (lightType == 1.0) {
		lightDir =  (uLightData[3*i] - vPosition).xyz;
	    lightDir2 = lightDir;
		float lightDist = length(lightDir);

		//Spherical light algorithm from http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
		float sphereRadius = uLightData[3*i].w;
		vec3 reflectedRay = reflect(-view, normal);
		vec3 centerToRay = dot(lightDir, reflectedRay) * reflectedRay - lightDir;
		lightDir2 = normalize(lightDir + centerToRay * clamp(sphereRadius / length(centerToRay), 0.0, 1.0));
		//todo normalize based on sphere size
	    power = pointAttenuation(lightDist, i);

	    if (uLightData[3*i+2].y > 0.5) {
	          float uFarDepth = uLightData[3*i+2].z;
              float ldist = lightDist/uFarDepth;
              ldist -= max(0.01 * (1.0 - clamp(dot(normal.xyz, lightDir), 0.0, 1.0)), 0.01);

              for(int i = 0; i < 4; i++) {
                vec3 offset = vec3(poissonDisk[i] * (ldist * uFarDepth / 2000.0), 0.0);
                vec3 dir = normalize(-lightDir);
                vec3 right = cross((dir + vec3(0.001, 0, 0)), vec3(0,1,0));
                vec3 up = cross(right, dir);

                int x =0; int y = 0;
                vec3 uv = dir + right * (offset.x + float(x)/100.0) + up * (offset.y + float(y) / 100.0);

               //TODO enable: shadow += textureShadowCube(ldist,  uv, i );
              }
              shadow /= 4.0;

	    } else {
	        shadow = 1.0;
	    }
	} else {
	    lightDir = normalize(uLightData[3*i].xyz);
	    lightDir2 = lightDir;

      vec3 pos = vPosition.xyz/vPosition.w;

      vec3 shadowPos = (uShadow_Matrix * vec4(pos, 1.0)).xyz / (uShadow_Matrix * vec4(pos, 1.0)).w;

      //TODO might want to change settings later
      shadowPos.z -= max(0.005 * (1.0 - clamp(dot(normal.xyz, lightDir), 1.0, 0.0)), 0.005);
      shadowPos.z = min(shadowPos.z, 0.9999);
      vec2 texelSize = 1.0 / vec2(textureSize(shadowTex, 0));
      vec2 size = vec2(textureSize(shadowTex, 0));


        for(int i = 0; i < 4; i++) {
            vec3 offset = vec3(poissonDisk[i] * texelSize, 0);
            vec2 uv = shadowPos.xy + offset.xy;

            //software bilinear + pcf shadow idea from http://codeflow.org/entries/2013/feb/15/soft-shadow-mapping/
            vec2 t = fract(uv*size - (0.5));
            uv = floor(uv*size - (0.5))/size;

            float a = textureShadow(shadowPos.z,  uv + vec2(0, 0) * texelSize);
            float b = textureShadow(shadowPos.z,  uv + vec2(1, 0) * texelSize);
            float c = textureShadow(shadowPos.z,  uv + vec2(0, 1) * texelSize);
            float d = textureShadow(shadowPos.z,  uv + vec2(1, 1) * texelSize);

            float e = mix(a, b, t.x);
            float f = mix(c, d, t.x);



            shadow += mix(e, f, t.y);
        }
        shadow /= 4.0;
	}

    diffuseLight = diffuseLight + shadow * (uLightData[3*i+1].xyz * (clamp(dot(lightDir2, normal) * power, 0.0, 1.0)));

	vec3 halfVec = normalize(view + lightDir);
	float dotNH = clamp(dot(normal, halfVec), 0.0, 1.0);

	float a2 = a*a;
	specColor += shadow * clamp(SpecularBRDF(uLightData[3*i+1].xyz, normal, view, lightDir2, a, F0, 1.0) * GGX_D(dotNH, a2*a2) * power, 0.0, 10.0);
  }


  vec3 diffuseColor = ((1.0-mat.r) * albedo.rgb) * diffuseLight;
  vec3 color = specColor + diffuseColor;


  frag_color = vec4(color, albedo.a);
  frag_normal = vec4(normal, 1.0);
  frag_material = vec4(mat, 1.0);
}
