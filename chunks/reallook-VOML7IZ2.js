import{Ab as pa,B as wt,Cb as ga,E as be,Ea as oa,Fa as je,G as qt,H as We,Ia as xe,J as Qt,K as ce,Ka as De,Kb as xa,L as Xt,La as _t,M as ye,Ma as ia,N as Zt,Sa as sa,Ua as st,V as nt,W as Yt,X as Kt,Y as Jt,Za as la,_a as ca,ab as ua,c as Ut,ca as ea,cb as fe,da as Q,db as te,e as Bt,ea as rt,eb as fa,f as Mt,fa as j,fb as Ct,g as ve,h as St,ha as ta,i as tt,ib as da,j as Vt,jb as ha,k as Ie,ka as ue,l as ke,la as ge,m as bt,n as yt,pa as K,q as Gt,r as Ot,ra as aa,s as It,sa as ot,t as at,ta as na,u as kt,ua as Dt,ub as ma,v as Wt,va as ra,w as jt,wa as we,x as $t,xb as va,y as Se,ya as it,z as Rt}from"./chunk-W2JFYTEC.js";var Ee={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};var le=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},Ga=new va(-1,1,1,-1,0,1),Pt=class extends it{constructor(){super(),this.setAttribute("position",new we([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new we([0,2,0,0,2,0],2))}},Oa=new Pt,de=class{constructor(e){this._mesh=new je(Oa,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Ga)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}};var _e=class extends le{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof te?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=fe.clone(e.uniforms),this.material=new te({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new de(this.material)}render(e,t,r){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=r.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var $e=class extends le{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,r){let a=e.getContext(),n=e.state;n.buffers.color.setMask(!1),n.buffers.depth.setMask(!1),n.buffers.color.setLocked(!0),n.buffers.depth.setLocked(!0);let i,l;this.inverse?(i=0,l=1):(i=1,l=0),n.buffers.stencil.setTest(!0),n.buffers.stencil.setOp(a.REPLACE,a.REPLACE,a.REPLACE),n.buffers.stencil.setFunc(a.ALWAYS,i,4294967295),n.buffers.stencil.setClear(l),n.buffers.stencil.setLocked(!0),e.setRenderTarget(r),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),n.buffers.color.setLocked(!1),n.buffers.depth.setLocked(!1),n.buffers.color.setMask(!0),n.buffers.depth.setMask(!0),n.buffers.stencil.setLocked(!1),n.buffers.stencil.setFunc(a.EQUAL,1,4294967295),n.buffers.stencil.setOp(a.KEEP,a.KEEP,a.KEEP),n.buffers.stencil.setLocked(!0)}},lt=class extends le{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}};var ct=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let r=e.getSize(new Q);this._width=r.width,this._height=r.height,t=new ue(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:ce}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new _e(Ee),this.copyPass.material.blending=ve,this.timer=new ga}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),r=!1;for(let a=0,n=this.passes.length;a<n;a++){let i=this.passes[a];if(i.enabled!==!1){if(i.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(a),i.render(this.renderer,this.writeBuffer,this.readBuffer,e,r),i.needsSwap){if(r){let l=this.renderer.getContext(),c=this.renderer.state.buffers.stencil;c.setFunc(l.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),c.setFunc(l.EQUAL,1,4294967295)}this.swapBuffers()}$e!==void 0&&(i instanceof $e?r=!0:i instanceof lt&&(r=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new Q);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let r=this._width*this._pixelRatio,a=this._height*this._pixelRatio;this.renderTarget1.setSize(r,a),this.renderTarget2.setSize(r,a);for(let n=0;n<this.passes.length;n++)this.passes[n].setSize(r,a)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var qe={name:"GTAOShader",defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new Q},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new ge},cameraProjectionMatrixInverse:{value:new ge},cameraWorldMatrix:{value:new ge},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new j(-1,-1,-1)},sceneBoxMax:{value:new j(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);

			#ifdef USE_REVERSED_DEPTH_BUFFER
				if (depth <= 0.0) {
					discard;
					return;
				}
			#else
				if (depth >= 1.0) {
					discard;
					return;
				}
			#endif
			
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`},Qe={name:"GTAODepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},ut={name:"GTAOBlendShader",uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`};function Ea(o=5){let e=Math.floor(o)%2===0?Math.floor(o)+1:Math.floor(o),t=Ia(e),r=t.length,a=new Uint8Array(r*4);for(let i=0;i<r;++i){let l=t[i],c=2*Math.PI*l/r,s=new j(Math.cos(c),Math.sin(c),0).normalize();a[i*4]=(s.x*.5+.5)*255,a[i*4+1]=(s.y*.5+.5)*255,a[i*4+2]=127,a[i*4+3]=255}let n=new xe(a,e,e);return n.wrapS=Se,n.wrapT=Se,n.needsUpdate=!0,n}function Ia(o){let e=Math.floor(o)%2===0?Math.floor(o)+1:Math.floor(o),t=e*e,r=Array(t).fill(0),a=Math.floor(e/2),n=e-1;for(let i=1;i<=t;){if(a===-1&&n===e?(n=e-2,a=0):(n===e&&(n=0),a<0&&(a=e-1)),r[a*e+n]!==0){n-=2,a++;continue}else r[a*e+n]=i++;n++,a--}return r}var Xe={name:"PoissonDenoiseShader",defines:{SAMPLES:16,SAMPLE_VECTORS:At(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new Q},cameraProjectionMatrixInverse:{value:new ge},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;

		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);

			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;

			denoised += w * neighborColor;
			totalWeight += w;
		}

		void main() {
			float depth = getDepth(vUv.xy);
			vec3 viewNormal = getViewNormal(vUv);
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);

			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}

			if (totalWeight > 0.) {
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function At(o,e,t){let r=ka(o,e,t),a="vec3[SAMPLES](";for(let n=0;n<o;n++){let i=r[n];a+=`vec3(${i.x}, ${i.y}, ${i.z})${n<o-1?",":")"}`}return a}function ka(o,e,t){let r=[];for(let a=0;a<o;a++){let n=2*Math.PI*e*a/o,i=Math.pow(a/(o-1),t);r.push(new j(Math.cos(n),Math.sin(n),i))}return r}var ft=class{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(e.random()*256);this.perm=[];for(let t=0;t<512;t++)this.perm[t]=this.p[t&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,t){let r,a,n,i=.5*(Math.sqrt(3)-1),l=(e+t)*i,c=Math.floor(e+l),s=Math.floor(t+l),u=(3-Math.sqrt(3))/6,f=(c+s)*u,A=c-f,E=s-f,v=e-A,h=t-E,x,b;v>h?(x=1,b=0):(x=0,b=1);let P=v-x+u,S=h-b+u,m=v-1+2*u,w=h-1+2*u,p=c&255,T=s&255,N=this.perm[p+this.perm[T]]%12,y=this.perm[p+x+this.perm[T+b]]%12,O=this.perm[p+1+this.perm[T+1]]%12,R=.5-v*v-h*h;R<0?r=0:(R*=R,r=R*R*this._dot(this.grad3[N],v,h));let g=.5-P*P-S*S;g<0?a=0:(g*=g,a=g*g*this._dot(this.grad3[y],P,S));let C=.5-m*m-w*w;return C<0?n=0:(C*=C,n=C*C*this._dot(this.grad3[O],m,w)),70*(r+a+n)}noise3d(e,t,r){let a,n,i,l,s=(e+t+r)*.3333333333333333,u=Math.floor(e+s),f=Math.floor(t+s),A=Math.floor(r+s),E=1/6,v=(u+f+A)*E,h=u-v,x=f-v,b=A-v,P=e-h,S=t-x,m=r-b,w,p,T,N,y,O;P>=S?S>=m?(w=1,p=0,T=0,N=1,y=1,O=0):P>=m?(w=1,p=0,T=0,N=1,y=0,O=1):(w=0,p=0,T=1,N=1,y=0,O=1):S<m?(w=0,p=0,T=1,N=0,y=1,O=1):P<m?(w=0,p=1,T=0,N=0,y=1,O=1):(w=0,p=1,T=0,N=1,y=1,O=0);let R=P-w+E,g=S-p+E,C=m-T+E,F=P-N+2*E,H=S-y+2*E,B=m-O+2*E,k=P-1+3*E,W=S-1+3*E,V=m-1+3*E,q=u&255,I=f&255,Z=A&255,z=this.perm[q+this.perm[I+this.perm[Z]]]%12,$=this.perm[q+w+this.perm[I+p+this.perm[Z+T]]]%12,X=this.perm[q+N+this.perm[I+y+this.perm[Z+O]]]%12,d=this.perm[q+1+this.perm[I+1+this.perm[Z+1]]]%12,M=.6-P*P-S*S-m*m;M<0?a=0:(M*=M,a=M*M*this._dot3(this.grad3[z],P,S,m));let D=.6-R*R-g*g-C*C;D<0?n=0:(D*=D,n=D*D*this._dot3(this.grad3[$],R,g,C));let _=.6-F*F-H*H-B*B;_<0?i=0:(_*=_,i=_*_*this._dot3(this.grad3[X],F,H,B));let U=.6-k*k-W*W-V*V;return U<0?l=0:(U*=U,l=U*U*this._dot3(this.grad3[d],k,W,V)),32*(a+n+i+l)}noise4d(e,t,r,a){let n=this.grad4,i=this.simplex,l=this.perm,c=(Math.sqrt(5)-1)/4,s=(5-Math.sqrt(5))/20,u,f,A,E,v,h=(e+t+r+a)*c,x=Math.floor(e+h),b=Math.floor(t+h),P=Math.floor(r+h),S=Math.floor(a+h),m=(x+b+P+S)*s,w=x-m,p=b-m,T=P-m,N=S-m,y=e-w,O=t-p,R=r-T,g=a-N,C=y>O?32:0,F=y>R?16:0,H=O>R?8:0,B=y>g?4:0,k=O>g?2:0,W=R>g?1:0,V=C+F+H+B+k+W,q=i[V][0]>=3?1:0,I=i[V][1]>=3?1:0,Z=i[V][2]>=3?1:0,z=i[V][3]>=3?1:0,$=i[V][0]>=2?1:0,X=i[V][1]>=2?1:0,d=i[V][2]>=2?1:0,M=i[V][3]>=2?1:0,D=i[V][0]>=1?1:0,_=i[V][1]>=1?1:0,U=i[V][2]>=1?1:0,J=i[V][3]>=1?1:0,L=y-q+s,G=O-I+s,Y=R-Z+s,ae=g-z+s,se=y-$+2*s,Me=O-X+2*s,pe=R-d+2*s,ie=g-M+2*s,he=y-D+3*s,Re=O-_+3*s,me=R-U+3*s,pt=g-J+3*s,gt=y-1+4*s,xt=O-1+4*s,Et=R-1+4*s,Tt=g-1+4*s,ze=x&255,Ne=b&255,Le=P&255,Fe=S&255,La=l[ze+l[Ne+l[Le+l[Fe]]]]%32,Fa=l[ze+q+l[Ne+I+l[Le+Z+l[Fe+z]]]]%32,Ua=l[ze+$+l[Ne+X+l[Le+d+l[Fe+M]]]]%32,Ba=l[ze+D+l[Ne+_+l[Le+U+l[Fe+J]]]]%32,Va=l[ze+1+l[Ne+1+l[Le+1+l[Fe+1]]]]%32,Ue=.6-y*y-O*O-R*R-g*g;Ue<0?u=0:(Ue*=Ue,u=Ue*Ue*this._dot4(n[La],y,O,R,g));let Be=.6-L*L-G*G-Y*Y-ae*ae;Be<0?f=0:(Be*=Be,f=Be*Be*this._dot4(n[Fa],L,G,Y,ae));let Ve=.6-se*se-Me*Me-pe*pe-ie*ie;Ve<0?A=0:(Ve*=Ve,A=Ve*Ve*this._dot4(n[Ua],se,Me,pe,ie));let Ge=.6-he*he-Re*Re-me*me-pt*pt;Ge<0?E=0:(Ge*=Ge,E=Ge*Ge*this._dot4(n[Ba],he,Re,me,pt));let Oe=.6-gt*gt-xt*xt-Et*Et-Tt*Tt;return Oe<0?v=0:(Oe*=Oe,v=Oe*Oe*this._dot4(n[Va],gt,xt,Et,Tt)),27*(u+f+A+E+v)}_dot(e,t,r){return e[0]*t+e[1]*r}_dot3(e,t,r,a){return e[0]*t+e[1]*r+e[2]*a}_dot4(e,t,r,a,n){return e[0]*t+e[1]*r+e[2]*a+e[3]*n}};var Ze=class o extends le{constructor(e,t,r=512,a=512,n,i,l){super(),this.width=r,this.height=a,this.clear=!0,this.camera=t,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=Ea(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new ue(this.width,this.height,{type:ce,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new te({defines:Object.assign({},qe.defines),uniforms:fe.clone(qe.uniforms),vertexShader:qe.vertexShader,fragmentShader:qe.fragmentShader,blending:ve,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=this.camera.isPerspectiveCamera?1:0,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new da,this.normalMaterial.blending=ve,this.pdMaterial=new te({defines:Object.assign({},Xe.defines),uniforms:fe.clone(Xe.uniforms),vertexShader:Xe.vertexShader,fragmentShader:Xe.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new te({defines:Object.assign({},Qe.defines),uniforms:fe.clone(Qe.uniforms),vertexShader:Qe.vertexShader,fragmentShader:Qe.fragmentShader,blending:ve}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new te({uniforms:fe.clone(Ee.uniforms),vertexShader:Ee.vertexShader,fragmentShader:Ee.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:yt,blendDst:ke,blendEquation:Ie,blendSrcAlpha:bt,blendDstAlpha:ke,blendEquationAlpha:Ie}),this.blendMaterial=new te({uniforms:fe.clone(ut.uniforms),vertexShader:ut.vertexShader,fragmentShader:ut.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:Vt,blendSrc:yt,blendDst:ke,blendEquation:Ie,blendSrcAlpha:bt,blendDstAlpha:ke,blendEquationAlpha:Ie}),this._fsQuad=new de(null),this._originalClearColor=new K,this.setGBuffer(n?n.depthTexture:void 0,n?n.normalTexture:void 0),i!==void 0&&this.updateGtaoMaterial(i),l!==void 0&&this.updatePdMaterial(l)}setSize(e,t){this.width=e,this.height=t,this.gtaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.pdRenderTarget.setSize(e,t),this.gtaoMaterial.uniforms.resolution.value.set(e,t),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,t),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(e,t){e!==void 0?(this.depthTexture=e,this.normalTexture=t,this._renderGBuffer=!1):(this.depthTexture=new st,this.depthTexture.format=Zt,this.depthTexture.type=Xt,this.normalRenderTarget=new ue(this.width,this.height,{minFilter:wt,magFilter:wt,type:ce,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0);let r=this.normalTexture?1:0,a=this.depthTexture===this.normalTexture?"w":"x";this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=r,this.gtaoMaterial.defines.DEPTH_SWIZZLING=a,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=r,this.pdMaterial.defines.DEPTH_SWIZZLING=a,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){e.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=e.radius),e.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),e.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),e.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),e.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=e.scale),e.samples!==void 0&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),e.screenSpaceRadius!==void 0&&(e.screenSpaceRadius?1:0)!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=e.screenSpaceRadius?1:0,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let t=!1;e.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),e.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),e.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),e.radius!==void 0&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),e.radiusExponent!==void 0&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,t=!0),e.rings!==void 0&&e.rings!==this.pdRings&&(this.pdRings=e.rings,t=!0),e.samples!==void 0&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,t=!0),t&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=At(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(e,t,r){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(e,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(e,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(e,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case o.OUTPUT.Off:break;case o.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=r.texture,this.copyMaterial.blending=ve,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case o.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=ve,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case o.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=ve,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case o.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:t);break;case o.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=ve,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case o.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=r.texture,this.copyMaterial.blending=ve,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(e,this.blendMaterial,this.renderToScreen?null:t);break;default:console.warn("THREE.GTAOPass: Unknown output type.")}}_renderPass(e,t,r,a,n){e.getClearColor(this._originalClearColor);let i=e.getClearAlpha(),l=e.autoClear;e.setRenderTarget(r),e.autoClear=!1,a!=null&&(e.setClearColor(a),e.setClearAlpha(n||0),e.clear()),this._fsQuad.material=t,this._fsQuad.render(e),e.autoClear=l,e.setClearColor(this._originalClearColor),e.setClearAlpha(i)}_renderOverride(e,t,r,a,n){e.getClearColor(this._originalClearColor);let i=e.getClearAlpha(),l=e.autoClear;e.setRenderTarget(r),e.autoClear=!1,a=t.clearColor||a,n=t.clearAlpha||n,a!=null&&(e.setClearColor(a),e.setClearAlpha(n||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=l,e.setClearColor(this._originalClearColor),e.setClearAlpha(i)}_overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(r){(r.isPoints||r.isLine||r.isLine2)&&r.visible&&(r.visible=!1,t.push(r))})}_restoreVisibility(){let e=this._visibilityCache;for(let t=0;t<e.length;t++)e[t].visible=!0;e.length=0}_generateNoise(e=64){let t=new ft,r=e*e*4,a=new Uint8Array(r);for(let i=0;i<e;i++)for(let l=0;l<e;l++){let c=i,s=l;a[(i*e+l)*4]=(t.noise(c,s)*.5+.5)*255,a[(i*e+l)*4+1]=(t.noise(c+e,s)*.5+.5)*255,a[(i*e+l)*4+2]=(t.noise(c,s+e)*.5+.5)*255,a[(i*e+l)*4+3]=(t.noise(c+e,s+e)*.5+.5)*255}let n=new xe(a,e,e,ye,We);return n.wrapS=Se,n.wrapT=Se,n.needsUpdate=!0,n}};Ze.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var Ye={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};var dt=class extends le{constructor(){super(),this.isOutputPass=!0,this.uniforms=fe.clone(Ye.uniforms),this.material=new fa({name:Ye.name,uniforms:this.uniforms,vertexShader:Ye.vertexShader,fragmentShader:Ye.fragmentShader}),this._fsQuad=new de(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,r){this.uniforms.tDiffuse.value=r.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},ta.getTransfer(this._outputColorSpace)===Jt&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Gt?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Ot?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===It?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===at?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Wt?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===jt?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===kt&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var Ta={name:"FXAAShader",uniforms:{tDiffuse:{value:null},resolution:{value:new Q(1/1024,1/512)}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec2 resolution;
		varying vec2 vUv;

		#define EDGE_STEP_COUNT 6
		#define EDGE_GUESS 8.0
		#define EDGE_STEPS 1.0, 1.5, 2.0, 2.0, 2.0, 4.0
		const float edgeSteps[EDGE_STEP_COUNT] = float[EDGE_STEP_COUNT]( EDGE_STEPS );

		float _ContrastThreshold = 0.0312;
		float _RelativeThreshold = 0.063;
		float _SubpixelBlending = 1.0;

		vec4 Sample( sampler2D  tex2D, vec2 uv ) {

			return texture( tex2D, uv );

		}

		float SampleLuminance( sampler2D tex2D, vec2 uv ) {

			return dot( Sample( tex2D, uv ).rgb, vec3( 0.3, 0.59, 0.11 ) );

		}

		float SampleLuminance( sampler2D tex2D, vec2 texSize, vec2 uv, float uOffset, float vOffset ) {

			uv += texSize * vec2(uOffset, vOffset);
			return SampleLuminance(tex2D, uv);

		}

		struct LuminanceData {

			float m, n, e, s, w;
			float ne, nw, se, sw;
			float highest, lowest, contrast;

		};

		LuminanceData SampleLuminanceNeighborhood( sampler2D tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData l;
			l.m = SampleLuminance( tex2D, uv );
			l.n = SampleLuminance( tex2D, texSize, uv,  0.0,  1.0 );
			l.e = SampleLuminance( tex2D, texSize, uv,  1.0,  0.0 );
			l.s = SampleLuminance( tex2D, texSize, uv,  0.0, -1.0 );
			l.w = SampleLuminance( tex2D, texSize, uv, -1.0,  0.0 );

			l.ne = SampleLuminance( tex2D, texSize, uv,  1.0,  1.0 );
			l.nw = SampleLuminance( tex2D, texSize, uv, -1.0,  1.0 );
			l.se = SampleLuminance( tex2D, texSize, uv,  1.0, -1.0 );
			l.sw = SampleLuminance( tex2D, texSize, uv, -1.0, -1.0 );

			l.highest = max( max( max( max( l.n, l.e ), l.s ), l.w ), l.m );
			l.lowest = min( min( min( min( l.n, l.e ), l.s ), l.w ), l.m );
			l.contrast = l.highest - l.lowest;
			return l;

		}

		bool ShouldSkipPixel( LuminanceData l ) {

			float threshold = max( _ContrastThreshold, _RelativeThreshold * l.highest );
			return l.contrast < threshold;

		}

		float DeterminePixelBlendFactor( LuminanceData l ) {

			float f = 2.0 * ( l.n + l.e + l.s + l.w );
			f += l.ne + l.nw + l.se + l.sw;
			f *= 1.0 / 12.0;
			f = abs( f - l.m );
			f = clamp( f / l.contrast, 0.0, 1.0 );

			float blendFactor = smoothstep( 0.0, 1.0, f );
			return blendFactor * blendFactor * _SubpixelBlending;

		}

		struct EdgeData {

			bool isHorizontal;
			float pixelStep;
			float oppositeLuminance, gradient;

		};

		EdgeData DetermineEdge( vec2 texSize, LuminanceData l ) {

			EdgeData e;
			float horizontal =
				abs( l.n + l.s - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.se - 2.0 * l.e ) +
				abs( l.nw + l.sw - 2.0 * l.w );
			float vertical =
				abs( l.e + l.w - 2.0 * l.m ) * 2.0 +
				abs( l.ne + l.nw - 2.0 * l.n ) +
				abs( l.se + l.sw - 2.0 * l.s );
			e.isHorizontal = horizontal >= vertical;

			float pLuminance = e.isHorizontal ? l.n : l.e;
			float nLuminance = e.isHorizontal ? l.s : l.w;
			float pGradient = abs( pLuminance - l.m );
			float nGradient = abs( nLuminance - l.m );

			e.pixelStep = e.isHorizontal ? texSize.y : texSize.x;

			if (pGradient < nGradient) {

				e.pixelStep = -e.pixelStep;
				e.oppositeLuminance = nLuminance;
				e.gradient = nGradient;

			} else {

				e.oppositeLuminance = pLuminance;
				e.gradient = pGradient;

			}

			return e;

		}

		float DetermineEdgeBlendFactor( sampler2D  tex2D, vec2 texSize, LuminanceData l, EdgeData e, vec2 uv ) {

			vec2 uvEdge = uv;
			vec2 edgeStep;
			if (e.isHorizontal) {

				uvEdge.y += e.pixelStep * 0.5;
				edgeStep = vec2( texSize.x, 0.0 );

			} else {

				uvEdge.x += e.pixelStep * 0.5;
				edgeStep = vec2( 0.0, texSize.y );

			}

			float edgeLuminance = ( l.m + e.oppositeLuminance ) * 0.5;
			float gradientThreshold = e.gradient * 0.25;

			vec2 puv = uvEdge + edgeStep * edgeSteps[0];
			float pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
			bool pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !pAtEnd; i++ ) {

				puv += edgeStep * edgeSteps[i];
				pLuminanceDelta = SampleLuminance( tex2D, puv ) - edgeLuminance;
				pAtEnd = abs( pLuminanceDelta ) >= gradientThreshold;

			}

			if ( !pAtEnd ) {

				puv += edgeStep * EDGE_GUESS;

			}

			vec2 nuv = uvEdge - edgeStep * edgeSteps[0];
			float nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
			bool nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			for ( int i = 1; i < EDGE_STEP_COUNT && !nAtEnd; i++ ) {

				nuv -= edgeStep * edgeSteps[i];
				nLuminanceDelta = SampleLuminance( tex2D, nuv ) - edgeLuminance;
				nAtEnd = abs( nLuminanceDelta ) >= gradientThreshold;

			}

			if ( !nAtEnd ) {

				nuv -= edgeStep * EDGE_GUESS;

			}

			float pDistance, nDistance;
			if ( e.isHorizontal ) {

				pDistance = puv.x - uv.x;
				nDistance = uv.x - nuv.x;

			} else {

				pDistance = puv.y - uv.y;
				nDistance = uv.y - nuv.y;

			}

			float shortestDistance;
			bool deltaSign;
			if ( pDistance <= nDistance ) {

				shortestDistance = pDistance;
				deltaSign = pLuminanceDelta >= 0.0;

			} else {

				shortestDistance = nDistance;
				deltaSign = nLuminanceDelta >= 0.0;

			}

			if ( deltaSign == ( l.m - edgeLuminance >= 0.0 ) ) {

				return 0.0;

			}

			return 0.5 - shortestDistance / ( pDistance + nDistance );

		}

		vec4 ApplyFXAA( sampler2D  tex2D, vec2 texSize, vec2 uv ) {

			LuminanceData luminance = SampleLuminanceNeighborhood( tex2D, texSize, uv );
			if ( ShouldSkipPixel( luminance ) ) {

				return Sample( tex2D, uv );

			}

			float pixelBlend = DeterminePixelBlendFactor( luminance );
			EdgeData edge = DetermineEdge( texSize, luminance );
			float edgeBlend = DetermineEdgeBlendFactor( tex2D, texSize, luminance, edge, uv );
			float finalBlend = max( pixelBlend, edgeBlend );

			if (edge.isHorizontal) {

				uv.y += edge.pixelStep * finalBlend;

			} else {

				uv.x += edge.pixelStep * finalBlend;

			}

			return Sample( tex2D, uv );

		}

		void main() {

			gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );

		}`};var ht=class extends _e{constructor(){super(Ta)}setSize(e,t){this.material.uniforms.resolution.value.set(1/e,1/t)}};var mt=class extends le{constructor(e,t,r=null,a=null,n=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=r,this.clearColor=a,this.clearAlpha=n,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new K}render(e,t,r){let a=e.autoClear;e.autoClear=!1;let n,i;this.overrideMaterial!==null&&(i=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(n=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:r),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(n),this.overrideMaterial!==null&&(this.scene.overrideMaterial=i),e.autoClear=a}};var Ma={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new K(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};var Ce=class o extends le{constructor(e,t=1,r,a){super(),this.strength=t,this.radius=r,this.threshold=a,this.resolution=e!==void 0?new Q(e.x,e.y):new Q(256,256),this.clearColor=new K(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let n=Math.round(this.resolution.x/2),i=Math.round(this.resolution.y/2);this.renderTargetBright=new ue(n,i,{type:ce,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let u=0;u<this.nMips;u++){let f=new ue(n,i,{type:ce,depthBuffer:!1});f.texture.name="UnrealBloomPass.h"+u,f.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(f);let A=new ue(n,i,{type:ce,depthBuffer:!1});A.texture.name="UnrealBloomPass.v"+u,A.texture.generateMipmaps=!1,this.renderTargetsVertical.push(A),n=Math.round(n/2),i=Math.round(i/2)}let l=Ma;this.highPassUniforms=fe.clone(l.uniforms),this.highPassUniforms.luminosityThreshold.value=a,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new te({uniforms:this.highPassUniforms,vertexShader:l.vertexShader,fragmentShader:l.fragmentShader}),this.separableBlurMaterials=[];let c=[6,10,14,18,22];n=Math.round(this.resolution.x/2),i=Math.round(this.resolution.y/2);for(let u=0;u<this.nMips;u++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(c[u])),this.separableBlurMaterials[u].uniforms.invSize.value=new Q(1/n,1/i),n=Math.round(n/2),i=Math.round(i/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let s=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=s,this.bloomTintColors=[new j(1,1,1),new j(1,1,1),new j(1,1,1),new j(1,1,1),new j(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=fe.clone(Ee.uniforms),this.blendMaterial=new te({uniforms:this.copyUniforms,vertexShader:Ee.vertexShader,fragmentShader:Ee.fragmentShader,premultipliedAlpha:!0,blending:tt,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new K,this._oldClearAlpha=1,this._basic=new oa,this._fsQuad=new de(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let r=Math.round(e/2),a=Math.round(t/2);this.renderTargetBright.setSize(r,a);for(let n=0;n<this.nMips;n++)this.renderTargetsHorizontal[n].setSize(r,a),this.renderTargetsVertical[n].setSize(r,a),this.separableBlurMaterials[n].uniforms.invSize.value=new Q(1/r,1/a),r=Math.round(r/2),a=Math.round(a/2)}render(e,t,r,a,n){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let i=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),n&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let l=this.renderTargetBright;for(let c=0;c<this.nMips;c++)this._fsQuad.material=this.separableBlurMaterials[c],this.separableBlurMaterials[c].uniforms.colorTexture.value=l.texture,this.separableBlurMaterials[c].uniforms.direction.value=o.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[c]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[c].uniforms.colorTexture.value=this.renderTargetsHorizontal[c].texture,this.separableBlurMaterials[c].uniforms.direction.value=o.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[c]),e.clear(),this._fsQuad.render(e),l=this.renderTargetsVertical[c];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,n&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(r),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=i}_getSeparableBlurMaterial(e){let t=[],r=e/3;for(let i=0;i<e;i++)t.push(.39894*Math.exp(-.5*i*i/(r*r))/r);let a=[],n=[];for(let i=1;i<e;i+=2){let l=t[i],c=i+1<e?t[i+1]:0,s=l+c;a.push((i*l+(i+1)*c)/s),n.push(s)}return new te({defines:{KERNEL_PAIRS:a.length},uniforms:{colorTexture:{value:null},invSize:{value:new Q(.5,.5)},direction:{value:new Q(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:a},gaussianWeights:{value:n}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new te({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};Ce.BlurDirectionX=new Q(1,0);Ce.BlurDirectionY=new Q(0,1);var Wa="silver-tongue-world3d-env";function Sa(o){return new Promise((e,t)=>{o.onsuccess=()=>e(o.result),o.onerror=()=>t(o.error)})}function ja(){return new Promise((o,e)=>{let t=indexedDB.open(Wa,1);t.onupgradeneeded=()=>t.result.createObjectStore("env"),t.onsuccess=()=>o(t.result),t.onerror=()=>e(t.error),t.onblocked=()=>e(new Error("env cache: blocked"))})}function Ht(o=new Map,e){let t=new Map,r=[],a=[];return{hits:r,misses:a,memo(n,i){let l=o.get(n);if(l)return r.push(n),l;a.push(n);let c=i();return t.set(n,c),o.set(n,c),c},async save(){t.size&&e&&await e(t),t.clear()}}}async function ba(o){if(o==="dev"||typeof indexedDB>"u")return Ht();let e=`1|${o}|`;try{let t=await ja(),a=t.transaction("env","readonly").objectStore("env"),n=await Sa(a.getAllKeys()),i=new Map;for(let l of n.filter(c=>c.startsWith(e)))i.set(l.slice(e.length),await Sa(a.get(l)));return Ht(i,async l=>{try{let c=t.transaction("env","readwrite"),s=c.objectStore("env");for(let u of n)u.startsWith(e)||s.delete(u);for(let[u,f]of l)s.put(f,e+u);await new Promise((u,f)=>{c.oncomplete=()=>u(),c.onerror=()=>f(c.error),c.onabort=()=>f(c.error)})}catch(c){console.warn("env cache: not saved",c)}})}catch(t){return console.warn("env cache: unavailable",t),Ht()}}var Je={min:-70,size:140,n:512},ya={near:{tile:26,n:200,fade:[9,12.5],size:[.13,.16],chunks:4,quads:3},far:{tile:72,n:200,fade:[24,30],size:[.26,.16],chunks:6,quads:1}},ee={clump:{scale:7.3,offset:.61,lo:.34,hi:.62,floor:.12},bare:{patch:[.6,.72],detail:[.52,.62],gone:[.12,.4]},root:[.3,.62,.3],mid:[.5,.85,.35],tip:[.85,1,.55],maxSat:.9,lawn:{sat:1.12},lean:.12},qa=[24,30];function Qa(o){return[{key:"near",...ya.near,shadow:!0},{key:"far",...ya.far,...o?{fade:qa}:{},shadow:!o}]}function Ra(o,e,t,r){let a=t-r/2,n=t+r/2,i=[];for(let l=Math.floor((a-e)/r);l<=Math.ceil((n-o)/r);l++){let c=Math.max(o+l*r,a),s=Math.min(e+l*r,n);c<s&&i.push([c,s])}return i}function Xa(o,e,t,r,a,n,i,l=new ot){for(let[c,s]of Ra(t.x0,t.x1,e.x,r))for(let[u,f]of Ra(t.z0,t.z1,e.y,r)){let A=Math.max(c-e.x,0,e.x-s),E=Math.max(u-e.y,0,e.y-f);if(!(A*A+E*E>a*a)&&(l.min.set(c,n,u),l.max.set(s,i,f),!o||o.intersectsBox(l)))return!0}return!1}var Pe={max:14e3,perM2:1.1,size:[.9,1.5],minY:1.6},Nt=/^grass_/,Lt=/^land_(path|dirt|plaza|plaza_ring|stone_edge|bank_stone|coping)$/,wa=/^water_/,Za=/^(canopy_green|leaf_green|leaf_dark|leaf_pale|town_willow)$/,Ya=/^(canopy_green|leaf_pale|town_willow)$/,Ka=2,zt={radius:[.72,.8,.72],shade:.55,detail:1};function Ke(o,e,t){let r=Math.imul(o,374761393)^Math.imul(e,668265263)^Math.imul(t+1,1442695041);return r=Math.imul(r^r>>>13,1274126177),r^=r>>>16,(r>>>0)/4294967296}function Ja(o,e,t,r){let a=Math.floor(o),n=Math.floor(e),i=o-a,l=e-n,c=i*i*(3-2*i),s=l*l*(3-2*l),u=h=>(h%t+t)%t,f=Ke(u(a),u(n),r),A=Ke(u(a+1),u(n),r),E=Ke(u(a),u(n+1),r),v=Ke(u(a+1),u(n+1),r);return f+(A-f)*c+(E-f)*s+(f-A-E+v)*c*s}function Te(o,e,t,r,a=4){let n=0,i=.5,l=0,c=t;for(let s=0;s<a;s++)n+=i*Ja(o*c,e*c,c,r+s*17),l+=i,i*=.5,c*=2;return n/l}function He(o){let e=o>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function Ae(o,e,t={}){let r=new xe(o,e,e,ye,We);return r.wrapS=r.wrapT=t.repeat===!1?Rt:Se,r.magFilter=be,r.minFilter=qt,r.generateMipmaps=!0,r.anisotropy=4,r.colorSpace=t.srgb?Yt:nt,r.needsUpdate=!0,r}function en(o){return{grass:Ae(o.grass,256),dirt:Ae(o.dirt,256),normal:Ae(o.normal,256),macro:Ae(o.macro,128)}}function Da(){let e=He(7),t=new Float32Array(256*256),r=new Float32Array(256*256),a=new Uint8Array(256*256*4),n=new Uint8Array(256*256*4),i=new Float32Array(256*256),l=new Float32Array(256*256),c=new Float32Array(256*256);for(let E=0;E<256;E++)for(let v=0;v<256;v++){let h=E*256+v,x=v/256,b=E/256;i[h]=(Te(x,b,6,1)-.5)*.5+(Te(x,b,24,2,2)-.5)*.35,l[h]=Te(x,b,4,3,3),t[h]=Te(x,b,32,4,2)*.3,c[h]=(Te(x,b,8,5)-.5)*.45+(Te(x,b,48,6,2)-.5)*.35,r[h]=Te(x,b,40,7,3)*.35}let s=(E,v)=>(v%256+256)%256*256+(E%256+256)%256;for(let E=0;E<5200;E++){let v=e()*256,h=e()*256,x=e()*Math.PI*2,b=3+e()*7,P=(e()-.45)*.55;for(let S=0;S<b;S++){let m=s(Math.round(v+Math.cos(x)*S),Math.round(h+Math.sin(x)*S)),w=1-S/b;i[m]+=P*(.5+.5*w),t[m]+=.5*w}}for(let E=0;E<900;E++){let v=e()*256,h=e()*256,x=.8+e()*e()*2.6,b=(e()-.35)*.22;for(let P=Math.floor(h-x-1);P<=h+x+1;P++)for(let S=Math.floor(v-x-1);S<=v+x+1;S++){let m=Math.hypot(S-v,P-h)/x,w=s(S,P);m<1?(c[w]+=b*(1-.3*((S-v+(P-h))/x)),r[w]+=Math.sqrt(1-m*m)*x*.12):m<1.3&&(c[w]-=.03)}}for(let E=0;E<256;E++)for(let v=0;v<256;v++){let h=E*256+v,x=i[h],b=Math.max(0,l[h]-.55)*1.6,P=h*4,S=w=>Math.max(0,Math.min(255,Math.round(w*127.5)));a[P]=S(1+x+b*.35),a[P+1]=S(1+x*.9+b*.12),a[P+2]=S(1+x*.8-b*.25),a[P+3]=255;let m=c[h];n[P]=S(1+m),n[P+1]=S(1+m*.95),n[P+2]=S(1+m*.88),n[P+3]=255}let u=new Uint8Array(256*256*4);for(let E=0;E<256;E++)for(let v=0;v<256;v++){let h=(E*256+v)*4,x=(p,T)=>[(p[s(v+1,E)]-p[s(v-1,E)])*T,(p[s(v,E+1)]-p[s(v,E-1)])*T],[b,P]=x(t,.5),[S,m]=x(r,.5),w=p=>Math.max(0,Math.min(255,Math.round((.5+p*.5)*255)));u[h]=w(b),u[h+1]=w(P),u[h+2]=w(S),u[h+3]=w(m)}let f=128,A=new Uint8Array(f*f*4);for(let E=0;E<f;E++)for(let v=0;v<f;v++){let h=(E*f+v)*4,x=v/f,b=E/f;A[h]=Math.round(Te(x,b,3,11,4)*255),A[h+1]=Math.round(Te(x,b,5,12,3)*255),A[h+2]=Math.round(Te(x,b,4,13,3)*255),A[h+3]=255}return{grass:a,dirt:n,normal:u,macro:A}}function tn(o){let e=(o?o.memo("leaf",_a):_a()).data,t=Ae(e,256,{repeat:!1,srgb:!0});return t.flipY=!1,t}function _a(){let e=He(21),t=new Uint8Array(256*256*4),r=Array.from({length:40},()=>{let a=Math.sqrt(e())*256*.36,n=e()*Math.PI*2,i=256/2+Math.cos(n)*a,l=256/2+Math.sin(n)*a;return{cx:i,cy:l,a:n+(e()-.5)*1.6,len:13+e()*9,wid:5.5+e()*3,tone:.72+e()*.4,hue:e()}});for(let a=0;a<256;a++)for(let n=0;n<256;n++){let i=(a*256+n)*4,l=0,c=[0,0,0];for(let s of r){let u=n-s.cx,f=a-s.cy,A=Math.cos(s.a),E=Math.sin(s.a),v=(u*A+f*E)/s.len,h=(-u*E+f*A)/s.wid,x=1-Math.abs(v);if(x<=0)continue;let b=1-h*h/(x*(1.3-.3*v));if(b<=0)continue;let P=Math.min(1,b*6);if(P>l){l=P;let S=Math.abs(h)<.08?.82:1,m=.8+.2*Math.min(1,b*2.5),w=s.tone*S*m;c=[w*(.86+s.hue*.2),w,w*(.7+s.hue*.12)]}}t[i]=Math.round(Math.min(1,c[0])*255),t[i+1]=Math.round(Math.min(1,c[1])*255),t[i+2]=Math.round(Math.min(1,c[2])*255),t[i+3]=Math.round(l*255)}return{data:t}}function an(o){let e=(o?o.memo("tuft",Ca):Ca()).data,t=Ae(e,et.n,{repeat:!1});return t.flipY=!1,t}var et={n:256,blades:[6,8],alphaTest:.5};function Ca(){let o=et.n,e=o/2,t=He(31),r=new Uint8Array(o*o*4);for(let n=0;n<o*o;n++)r[n*4]=r[n*4+1]=r[n*4+2]=230,r[n*4+3]=0;let a=new Float32Array(o*o);for(let n=0;n<2;n++){let i=et.blades[n];for(let l=0;l<i;l++){let c=.5+(l/(i-1)-.5)*.36+(t()-.5)*.05,s=(c-.5)*(.3+t()*.3)+(t()-.5)*.08,u=(t()-.5)*.1+Math.sign(s)*.04,f=.55+t()*.42,A=2.6+t()*1.6,E=.78+t()*.22;for(let v=0;v<Math.ceil(f*o);v++){let x=(v+.5)/o/f;if(x>=1)break;let b=(c+s*x+u*x*x)*e,P=A*Math.pow(1-x,.75),S=1-ln(.78,1,x);for(let m=Math.max(0,Math.floor(b-P-2));m<=Math.min(e-1,Math.ceil(b+P+2));m++){let w=Math.abs(m+.5-b),p=Math.max(0,Math.min(1,P-w+.5))*S,T=v*o+n*e+m;if(p<=a[T])continue;a[T]=p;let N=w<P*.3?1.06:.94+.06*(1-w/Math.max(P,.5)),y=Math.round(Math.min(1,E*N)*255);r[T*4]=r[T*4+1]=r[T*4+2]=y,r[T*4+3]=Math.round(p*255)}}}}return{data:r}}function nn(o){return Array.isArray(o.material)?"":o.material.name}function rn(o){let e=Je.n,t=new xe(o.half,e,e,ye,ce);t.magFilter=be,t.minFilter=be,t.wrapS=t.wrapT=Rt,t.colorSpace=nt,t.needsUpdate=!0;let r=new xe(o.albedo,e,e,ye,We);return r.magFilter=be,r.minFilter=be,r.colorSpace=nt,r.needsUpdate=!0,{tex:t,albedo:r,grass:o.grass,height:o.height}}function on(o,e,t){return rn(t?t.memo("field",()=>Pa(o,e)):Pa(o,e))}function Pa(o,e){let{min:t,size:r,n:a}=Je,n=r/a,i=new Uint8Array(a*a),l=new Float32Array(a*a).fill(-1e9),c=new Float32Array(a*a*3),s=new j,u=new j,f=new j;o.updateMatrixWorld(!0),o.traverse(p=>{let T=p;if(!T.isMesh||T.userData.outline||T.isInstancedMesh)return;let N=nn(T),y=Nt.test(N)?1:Lt.test(N)?2:wa.test(N)?3:0;if(!y)return;let O=T.material.color??new K(1,1,1),R=T.geometry.getAttribute("position"),g=T.geometry.index,C=g?g.count/3:R.count/3,F=T.matrixWorld;for(let H=0;H<C;H++){let B=g?g.getX(H*3):H*3,k=g?g.getX(H*3+1):H*3+1,W=g?g.getX(H*3+2):H*3+2;s.fromBufferAttribute(R,B).applyMatrix4(F),u.fromBufferAttribute(R,k).applyMatrix4(F),f.fromBufferAttribute(R,W).applyMatrix4(F);let V=u.x-s.x,q=u.y-s.y,I=u.z-s.z,Z=f.x-s.x,z=f.y-s.y,$=f.z-s.z,X=q*$-I*z,d=I*Z-V*$,M=V*z-q*Z,D=Math.hypot(X,d,M);if(D<1e-9||Math.abs(d)<.35*D)continue;let _=Math.max(0,Math.floor((Math.min(s.x,u.x,f.x)-t)/n)),U=Math.min(a-1,Math.ceil((Math.max(s.x,u.x,f.x)-t)/n)),J=Math.max(0,Math.floor((Math.min(s.z,u.z,f.z)-t)/n)),L=Math.min(a-1,Math.ceil((Math.max(s.z,u.z,f.z)-t)/n));if(_>U||J>L)continue;let G=(u.z-f.z)*(s.x-f.x)+(f.x-u.x)*(s.z-f.z);if(!(Math.abs(G)<1e-12))for(let Y=J;Y<=L;Y++)for(let ae=_;ae<=U;ae++){let se=t+(ae+.5)*n,Me=t+(Y+.5)*n,pe=((u.z-f.z)*(se-f.x)+(f.x-u.x)*(Me-f.z))/G,ie=((f.z-s.z)*(se-f.x)+(s.x-f.x)*(Me-f.z))/G,he=1-pe-ie;if(pe<-1e-4||ie<-1e-4||he<-1e-4)continue;let Re=pe*s.y+ie*u.y+he*f.y,me=Y*a+ae;(y===1?Re<=l[me]+.05:Re<=l[me]-.05)||(l[me]=Re,i[me]=y,c[me*3]=O.r,c[me*3+1]=O.g,c[me*3+2]=O.b)}}}),o.traverse(p=>{let T=p;if(!T.isMesh||!T.visible||T.userData.outline||T.isSkinnedMesh||T.isInstancedMesh||Array.isArray(T.material))return;let N=T.material,y=N.name;if(!N.visible||N.isMeshBasicMaterial||Nt.test(y)||Lt.test(y)||wa.test(y)||y.startsWith("env_"))return;let O=T.geometry;O.computeBoundingBox();let R=O.boundingBox.clone().applyMatrix4(T.matrixWorld);if(R.min.y>9||R.max.x<t||R.min.x>t+r||R.max.z<t||R.min.z>t+r)return;let g=O.getAttribute("position"),C=O.index,F=C?C.count/3:g.count/3,H=T.matrixWorld;for(let B=0;B<F;B++){if(s.fromBufferAttribute(g,C?C.getX(B*3):B*3).applyMatrix4(H),u.fromBufferAttribute(g,C?C.getX(B*3+1):B*3+1).applyMatrix4(H),f.fromBufferAttribute(g,C?C.getX(B*3+2):B*3+2).applyMatrix4(H),Math.min(s.y,u.y,f.y)>9)continue;let k=(u.z-f.z)*(s.x-f.x)+(f.x-u.x)*(s.z-f.z);if(Math.abs(k)<1e-6)continue;let W=Math.max(0,Math.floor((Math.min(s.x,u.x,f.x)-t)/n)),V=Math.min(a-1,Math.ceil((Math.max(s.x,u.x,f.x)-t)/n)),q=Math.max(0,Math.floor((Math.min(s.z,u.z,f.z)-t)/n)),I=Math.min(a-1,Math.ceil((Math.max(s.z,u.z,f.z)-t)/n));for(let Z=q;Z<=I;Z++)for(let z=W;z<=V;z++){let $=Z*a+z;if(i[$]!==1)continue;let X=t+(z+.5)*n,d=t+(Z+.5)*n,M=((u.z-f.z)*(X-f.x)+(f.x-u.x)*(d-f.z))/k,D=((f.z-s.z)*(X-f.x)+(s.x-f.x)*(d-f.z))/k,_=1-M-D;if(M<-.02||D<-.02||_<-.02)continue;let U=M*s.y+D*u.y+_*f.y;U>l[$]-.3&&U<l[$]+.9&&(i[$]=2)}}});let A=Math.PI/180;for(let p of e.blockers){let T=Math.max(0,Math.floor((p.min[0]-t)/n)),N=Math.min(a-1,Math.ceil((p.max[0]-t)/n)),y=Math.max(0,Math.floor((p.min[1]-t)/n)),O=Math.min(a-1,Math.ceil((p.max[1]-t)/n));for(let R=y;R<=O;R++)for(let g=T;g<=N;g++){let C=t+(g+.5)*n,F=t+(R+.5)*n;if(C<p.min[0]||C>p.max[0]||F<p.min[1]||F>p.max[1])continue;let H=p.obb;if(H){let B=H.rotY*A,k=C-H.centre[0],W=F-H.centre[1],V=k*Math.cos(B)-W*Math.sin(B),q=k*Math.sin(B)+W*Math.cos(B);if(Math.abs(V)>H.half[0]||Math.abs(q)>H.half[1])continue}i[R*a+g]===1&&(i[R*a+g]=2)}}let E=1e9,v=new Float32Array(a*a);for(let p=0;p<a*a;p++)v[p]=i[p]===1?E:0;let h=n,x=n*Math.SQRT2;for(let p=0;p<a;p++)for(let T=0;T<a;T++){let N=p*a+T,y=v[N];y!==0&&(T>0&&(y=Math.min(y,v[N-1]+h)),p>0&&(y=Math.min(y,v[N-a]+h),T>0&&(y=Math.min(y,v[N-a-1]+x)),T<a-1&&(y=Math.min(y,v[N-a+1]+x))),v[N]=y)}for(let p=a-1;p>=0;p--)for(let T=a-1;T>=0;T--){let N=p*a+T,y=v[N];y!==0&&(T<a-1&&(y=Math.min(y,v[N+1]+h)),p<a-1&&(y=Math.min(y,v[N+a]+h),T<a-1&&(y=Math.min(y,v[N+a+1]+x)),T>0&&(y=Math.min(y,v[N+a-1]+x))),v[N]=y)}let b=new Uint16Array(a*a*4),P=new Uint8Array(a*a*4),S=new Uint8Array(a*a),m=new Float32Array(a*a),w=na.toHalfFloat;for(let p=0;p<a*a;p++){let T=i[p]===1?1:0;S[p]=T,m[p]=l[p]>-1e8?l[p]:0,b[p*4]=w(T),b[p*4+1]=w(Math.min(8,v[p])),b[p*4+2]=w(m[p]),b[p*4+3]=w(1);for(let N=0;N<3;N++)P[p*4+N]=Math.round(Math.min(1,c[p*3+N])*255);P[p*4+3]=255}return{half:b,albedo:P,grass:S,height:m}}function ne(o,e,t,r="after"){let a=o.indexOf(e);if(a<0)throw new Error(`envlook: no "${e}" in the shader`);return r==="replace"?o.slice(0,a)+t+o.slice(a+e.length):r==="before"?o.slice(0,a)+t+o.slice(a):o.slice(0,a+e.length)+t+o.slice(a+e.length)}function Ft(o,e,t){let r=o.onBeforeCompile,a=o.customProgramCacheKey();o.onBeforeCompile=(n,i)=>{r.call(o,n,i),t(n)},o.customProgramCacheKey=()=>`${a}|env-${e}`,o.needsUpdate=!0}var sn=`
float envHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`,re=o=>o.toFixed(3),vt=o=>`vec3(${o.map(re).join(", ")})`,Aa=`
float envBare(float m, float m2) { return smoothstep(${re(ee.bare.patch[0])}, ${re(ee.bare.patch[1])}, m) * 0.7 * smoothstep(${re(ee.bare.detail[0])}, ${re(ee.bare.detail[1])}, m2); }
`,ln=(o,e,t)=>{let r=Math.max(0,Math.min(1,(t-o)/(e-o)));return r*r*(3-2*r)};function Na(o,e,t){let r=o.userData.lookGround,a=()=>o.userData.lookSky,n=!!r?.town,i=[],l=[],c={envTime:{value:0},envCenter:{value:new Q},envFieldMin:{value:new Q(Je.min,Je.min)},envFieldSize:{value:Je.size},envWind:{value:new Q(.8,.6).normalize()}},s={},u=(g,C)=>{let F=performance.now();try{return C()}finally{s[g]=+((s[g]??0)+performance.now()-F).toFixed(1)}},f,A=()=>f??=u("textures",()=>en(t.cache?t.cache.memo("ground",Da):Da())),E,v=()=>E??=u("field",()=>on(o,r,t.cache)),h=[],x={leaves:[],particles:[]},b=!1,P=null,S=(g,C)=>Math.round(g*Math.max(0,Math.min(1,C))),m=!0,w=0,p=performance.now();if(n&&e.has("ground")){let g=A(),C=v(),F={...c,envGrassTex:{value:g.grass},envDirtTex:{value:g.dirt},envDetailN:{value:g.normal},envMacro:{value:g.macro},envField:{value:C.tex},envDirtColor:{value:new K(.36,.27,.16)}},H=new Set;o.traverse(B=>{let k=B;if(!k.isMesh||k.userData.outline||Array.isArray(k.material))return;let W=k.material;if(H.has(W)||!W.isMeshStandardMaterial)return;let V=Nt.test(W.name);if(!V&&!Lt.test(W.name))return;H.add(W);let q=/plaza|coping|stone/.test(W.name)?.45:.85;Ft(W,V?"grass":`path${q}`,I=>{Object.assign(I.uniforms,F),I.vertexShader=ne(I.vertexShader,"void main() {",`varying vec3 vEnvW;
`,"before"),I.vertexShader=ne(I.vertexShader,"#include <begin_vertex>",`
  vEnvW = (modelMatrix * vec4(transformed, 1.0)).xyz;`),I.fragmentShader=ne(I.fragmentShader,"void main() {",`
${V?"#define ENV_GRASS":""}
#define ENV_DETAIL ${q.toFixed(2)}
varying vec3 vEnvW;
uniform sampler2D envGrassTex, envDirtTex, envDetailN, envMacro, envField;
uniform vec2 envFieldMin;
uniform float envFieldSize;
uniform vec3 envDirtColor;
${Aa}
`,"before"),I.fragmentShader=ne(I.fragmentShader,"#include <color_fragment>",`
  vec2 envP = vEnvW.xz;
  float envNear = 1.0 - smoothstep(45.0, 160.0, length(vEnvW - cameraPosition));
  vec4 envM = texture2D(envMacro, envP / 41.0);
  vec4 envM2 = texture2D(envMacro, envP / 6.7 + 0.37);
  vec3 envD = texture2D(envDirtTex, envP / 3.1).rgb * 2.0;
  float envMix = 1.0;
#ifdef ENV_GRASS
  vec3 envG = texture2D(envGrassTex, envP / 2.3).rgb * 2.0;
  vec2 envFuv = (envP - envFieldMin) / envFieldSize;
  bool envIn = all(greaterThan(envFuv, vec2(0.002))) && all(lessThan(envFuv, vec2(0.998)));
  float envDist = envIn ? texture2D(envField, envFuv).g : 8.0;
  // worn dirt along the path edges (a ragged line: the noise moves it), and a few bare patches
  float envWear = 1.0 - smoothstep(0.1, 1.25, envDist + (envM2.r - 0.5) * 1.5);
  float envPatch = envBare(envM.r, envM2.g);
  envMix = clamp(max(envWear, envPatch), 0.0, 1.0);
  vec3 envGrass = diffuseColor.rgb * mix(vec3(1.0), envG, envNear) * mix(vec3(0.84, 0.88, 0.86), vec3(1.14, 1.1, 0.88), envM.g);
  // the lawn in the tufts' middle green (GRASS_LOOK.lawn: on screen a little less saturated than them): the tufts read as its texture
  envGrass *= ${vt(ee.mid)};
  envGrass = max(vec3(0.0), mix(vec3(dot(envGrass, vec3(0.2126, 0.7152, 0.0722))), envGrass, ${re(ee.lawn.sat)}));
  vec3 envDirt = envDirtColor * mix(vec3(1.0), envD, envNear) * mix(0.9, 1.1, envM2.b);
  diffuseColor.rgb = mix(envGrass, envDirt, envMix);
#else
  diffuseColor.rgb *= mix(vec3(1.0), envD, ENV_DETAIL * envNear) * mix(0.93, 1.07, envM.g);
#endif
`),V&&(I.fragmentShader=ne(I.fragmentShader,"#include <roughnessmap_fragment>",`
  roughnessFactor = mix(0.95, 0.88, envMix);`)),I.fragmentShader=ne(I.fragmentShader,"#include <normal_fragment_maps>",`
  {
    vec2 envSG = texture2D(envDetailN, envP / 2.3).rg * 2.0 - 1.0;
    vec2 envSD = texture2D(envDetailN, envP / 3.1).ba * 2.0 - 1.0;
#ifdef ENV_GRASS
    vec2 envS = mix(envSG * 0.9, envSD * 1.4, envMix) * envNear;
#else
    vec2 envS = envSD * 0.8 * ENV_DETAIL * envNear;
#endif
    normal = normalize(normal + mat3(viewMatrix) * vec3(-envS.x, 0.0, -envS.y));
  }
`)})}),i.push("ground")}s.ground=+(performance.now()-p).toFixed(1);let T=performance.now();if(n&&e.has("grass")){let g=A(),C=v(),F={...c,envField:{value:C.tex},envAlbedo:{value:C.albedo},envGrassTex:{value:g.grass},envMacro:{value:g.macro},envTuft:{value:an(t.cache)}},H=He(99),B=z=>{let $=[],X=[],d=[];for(let M=0;M<z;M++){let D=M*Math.PI/z,_=Math.cos(D),U=Math.sin(D),J=M*4;for(let[L,G]of[[-.5,0],[.5,0],[.5,1],[-.5,1]])$.push(_*L,G,U*L),X.push(L+.5,G);d.push(J,J+1,J+2,J,J+2,J+3)}return{position:new we($,3),normal:new we($.map((M,D)=>D%3===1?1:0),3),uv:new we(X,2),index:new ra(d,1)}},k=1/0,W=-1/0;C.height.forEach((z,$)=>{C.grass[$]&&(k=Math.min(k,z),W=Math.max(W,z))}),k<=W||(k=W=0);for(let z of Qa(!!t.lite)){let $=z.key,X=z.n*z.n,d=new Float32Array(X*4),M=z.tile/z.n;for(let L=0,G=0;L<z.n;L++)for(let Y=0;Y<z.n;Y++,G++)d[G*4]=(Y+H())*M,d[G*4+1]=(L+H())*M,d[G*4+2]=H()*Math.PI*2,d[G*4+3]=H();let D=B(z.quads),_=new ha({color:16777215,side:Mt,alphaTest:et.alphaTest,name:`env_grass_${$}`});_.onBeforeCompile=L=>{Object.assign(L.uniforms,F,{envTile:{value:z.tile},envFade:{value:new Q(z.fade[0],z.fade[1])},envSize:{value:new Q(z.size[0],z.size[1])}}),L.vertexShader=ne(L.vertexShader,"void main() {",`
attribute vec4 aBlade;
uniform float envTime, envTile, envFieldSize;
uniform vec2 envCenter, envFade, envSize, envFieldMin, envWind;
uniform sampler2D envField, envAlbedo, envGrassTex, envMacro;
varying vec3 vBlade;
varying vec2 vBladeY;
varying vec2 vTuftUv;
${Aa}
`,"before"),L.vertexShader=ne(L.vertexShader,"#include <beginnormal_vertex>","vec3 objectNormal = vec3(0.0, 1.0, 0.0);","replace"),L.vertexShader=ne(L.vertexShader,"#include <begin_vertex>",`
  // the tile's copy of this blade nearest the player (the tile wraps round them as they walk)
  vec2 bp = aBlade.xy + envTile * floor((envCenter - aBlade.xy) / envTile + 0.5);
  float bd = distance(bp, envCenter);
  vec2 fuv = (bp - envFieldMin) / envFieldSize;
  float inside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
  vec4 fld = textureLod(envField, fuv, 0.0);
  float r = aBlade.w;
  // clumps and thin patches (GRASS_LOOK.clump; grassDensityAt mirrors this), none on a bare patch
  float clump = textureLod(envMacro, bp / ${re(ee.clump.scale)} + ${re(ee.clump.offset)}, 0.0).r;
  float dens = ${re(ee.clump.floor)} + ${re(1-ee.clump.floor)} * smoothstep(${re(ee.clump.lo)}, ${re(ee.clump.hi)}, clump);
  float bare = envBare(textureLod(envMacro, bp / 41.0, 0.0).r, textureLod(envMacro, bp / 6.7 + 0.37, 0.0).g);
  float keep = fld.r * inside * step(fract(r * 13.37), dens) * (1.0 - smoothstep(${re(ee.bare.gone[0])}, ${re(ee.bare.gone[1])}, bare));
  keep *= smoothstep(0.12, 0.7, fld.g + r * 0.35) * (1.0 - smoothstep(envFade.x, envFade.y, bd + r * 1.5));
  keep = keep > 0.08 ? keep : 0.0;
  float h = envSize.y * (0.62 + 0.38 * r) * mix(0.8, 1.0, dens) * keep;
  float w = envSize.x * (0.8 + 0.4 * fract(r * 7.13)) * step(0.001, keep);
${z.quads===1?`
  // one card turned to the camera (about the vertical), a little off it
  vec2 envTo = cameraPosition.xz - bp;
  float envA = atan(envTo.y, envTo.x) + 1.5708 + (fract(r * 3.1) - 0.5) * 0.5;
  float ca = cos(envA), sa = sin(envA);`:`
  float ca = cos(aBlade.z), sa = sin(aBlade.z);`}
  float bend = position.y * position.y;
  float t = envTime;
  float gust = textureLod(envMacro, bp / 29.0 + vec2(t * 0.031, t * 0.017), 0.0).b;
  float sway = sin(t * 1.8 + bp.x * 0.41 + bp.y * 0.27 + r * 6.2832) * 0.3 + (gust - 0.45) * 1.6;
  // the card's quads turned by the tuft's angle; the tuft leans a few degrees its own way (GRASS_LOOK.lean)
  vec2 envXZ = vec2(ca * position.x - sa * position.z, sa * position.x + ca * position.z) * w;
  vec2 envLean = (vec2(fract(r * 17.3), fract(r * 23.1)) - 0.5) * ${re(2*ee.lean)};
  vec3 transformed = vec3(bp.x + envXZ.x, fld.b + position.y * h, bp.y + envXZ.y);
  transformed.xz += envLean * position.y * h;
  transformed.xz += (envWind * sway + vec2(-sa, ca) * (r - 0.5) * 0.8) * bend * h * 0.5;
  vec3 alb = textureLod(envAlbedo, fuv, 0.0).rgb;
  vec3 gt = textureLod(envGrassTex, bp / 2.3, 0.0).rgb * 2.0;
  float tone = textureLod(envMacro, bp / 41.0, 0.0).g;
  // the ground shader's lawn colour here (material x grass texture x macro tone: the blades grow out
  // of it), a little brightness of its own per tuft; the root-to-tip ramp in the fragment
  vBlade = alb * gt * mix(vec3(0.84, 0.88, 0.86), vec3(1.14, 1.1, 0.88), tone) * (0.94 + 0.12 * fract(r * 3.7));
  vBladeY = vec2(position.y, 0.45 + 0.55 * fract(r * 9.13));
  // a variant (u 0-0.5 / 0.5-1), mirrored or not
  float envU = fract(r * 41.7) < 0.5 ? uv.x : 1.0 - uv.x;
  vTuftUv = vec2(envU * 0.5 + step(0.5, fract(r * 29.7)) * 0.5, uv.y);
`,"replace"),L.fragmentShader=ne(L.fragmentShader,"void main() {",`varying vec3 vBlade;
varying vec2 vBladeY;
varying vec2 vTuftUv;
uniform sampler2D envTuft;
`,"before"),L.fragmentShader=ne(L.fragmentShader,"#include <color_fragment>",`
  // the tuft's blades (alpha-tested: TUFT.alphaTest); the mips' coverage held up so the far
  // tufts don't thin out as their alpha averages down
  vec4 envT = texture2D(envTuft, vTuftUv);
  vec2 envTs = vTuftUv * ${et.n.toFixed(1)};
  float envLod = max(0.0, 0.5 * log2(max(dot(dFdx(envTs), dFdx(envTs)), dot(dFdy(envTs), dFdy(envTs)))));
  diffuseColor.a = envT.a * (1.0 + envLod * 0.35);
  // a deep green at the root, the lawn's green up the blade, a bright green-yellow at the tip (each tuft its own share), no more than maxSat saturated
  vec3 envBladeC = vBlade * mix(${vt(ee.root)}, ${vt(ee.mid)}, smoothstep(0.0, 0.5, vBladeY.x));
  envBladeC = mix(envBladeC, vBlade * ${vt(ee.tip)}, smoothstep(0.5, 1.0, vBladeY.x) * (0.4 + 0.6 * vBladeY.y));
  envBladeC *= envT.rgb / 0.9;
  {
    float mx = max(envBladeC.r, max(envBladeC.g, envBladeC.b));
    float mn = min(envBladeC.r, min(envBladeC.g, envBladeC.b));
    float sat = (mx - mn) / max(mx, 1e-4);
    if (sat > ${re(ee.maxSat)}) envBladeC = mx - (mx - envBladeC) * (${re(ee.maxSat)} / sat);
  }
  diffuseColor.rgb *= envBladeC;`),L.fragmentShader=ne(L.fragmentShader,"#include <normal_fragment_begin>",`
#ifdef DOUBLE_SIDED
  normal *= faceDirection;
#endif`)},_.customProgramCacheKey=()=>`env-grass-${$}`,z.shadow||(_.name+="_unshadowed");let U=z.tile/z.chunks,J=Array.from({length:z.chunks*z.chunks},()=>[]);for(let L=0;L<X;L++){let G=Math.min(z.chunks-1,Math.floor(d[L*4]/U)),Y=Math.min(z.chunks-1,Math.floor(d[L*4+1]/U));J[Y*z.chunks+G].push(L)}J.forEach((L,G)=>{for(let ie=L.length-1;ie>0;ie--){let he=Math.floor(H()*(ie+1));[L[ie],L[he]]=[L[he],L[ie]]}let Y=new Float32Array(L.length*4);L.forEach((ie,he)=>Y.set(d.subarray(ie*4,ie*4+4),he*4));let ae=new pa;ae.setAttribute("position",D.position),ae.setAttribute("normal",D.normal),ae.setAttribute("uv",D.uv),ae.setIndex(D.index),ae.setAttribute("aBlade",new De(Y,4)),ae.userData.blades=L.length,ae.instanceCount=S(L.length,t.grassDensity??1);let se=new je(ae,_);se.name=`env_grass_${$}`,se.frustumCulled=!1,se.receiveShadow=z.shadow,se.castShadow=!1,se.matrixAutoUpdate=!1;let Me=G%z.chunks,pe=Math.floor(G/z.chunks);se.userData.chunk={x0:Me*U,x1:(Me+1)*U,z0:pe*U,z1:(pe+1)*U,tile:z.tile,reach:z.fade[1]+1.5},o.add(se),h.push(se)}),t.aoHidden.push(_)}let V=new ia,q=new ge,I=new ot,Z={x:0,y:0};l.push((z,$)=>{z.updateMatrixWorld(),q.multiplyMatrices(z.projectionMatrix,z.matrixWorldInverse),V.setFromProjectionMatrix(q),Z.x=$.x,Z.y=$.z,w=0;for(let X of h){let d=X.userData.chunk;X.visible=m&&Xa(V,Z,d,d.tile,d.reach,k,W+.6,I),X.visible&&(w+=X.geometry.instanceCount)}}),i.push("grass")}if(s.grass=+(performance.now()-T).toFixed(1),n&&e.has("leaves")){let g=u("leaves",()=>cn(o,t,c));g&&(i.push("leaves"),x.leaves.push(g),g.userData.core&&x.leaves.push(g.userData.core))}if(n&&e.has("sky")&&(u("sky",()=>fn(o,r,a,c,t,l,A)),i.push("sky")),n&&e.has("particles")){let g=new Set(o.children);dn(o,c,t,l),x.particles.push(...o.children.filter(C=>!g.has(C))),i.push("particles")}if(e.has("bloom")){let g=mn(o);P=g,b=!0,l.push((C,F,H,B)=>{b&&g(B)}),i.push("bloom")}e.has("grade")&&i.push("grade");let N=0,y=-1,O=new j;return{layers:i,timings:s,get grass(){return{chunks:h.length,drawn:h.filter(g=>g.visible).length,blades:w}},get evening(){return N},update(g,C,F){let B=a()?.daylight??0;N=ea.smoothstep(B,.5,.95);let k=C??O.copy(g.position);if(c.envTime.value=F,c.envCenter.value.set(k.x,k.z),F!==y)for(let W of l)W(g,k,F,N);y=F},restrict(g,C){for(let[F,H]of Object.entries(x))for(let B of H)g.has(F)||!B.visible||(B.visible=!1,B.userData.restore?.());m=g.has("grass");for(let F of h)F.visible=m&&F.visible,F.geometry.instanceCount=S(F.geometry.userData.blades,C);P&&b&&!g.has("bloom")&&(b=!1,P(0)),i.splice(0,i.length,...i.filter(F=>g.has(F)))}}}function cn(o,e,t){o.updateMatrixWorld(!0);let r=[];if(o.traverse(R=>{let g=R;!g.isMesh||g.userData.outline||g.isInstancedMesh||Array.isArray(g.material)||Za.test(g.material.name)&&r.push(g)}),!r.length)return null;let a=[],n=0;for(let R of r){let g=R.geometry,C=g.getAttribute("position"),F=g.getAttribute(e.seeAttr),H=g.index,B=H?H.count/3:C.count/3,k=(R.material.color??new K(.2,.4,.1)).clone(),W=Ya.test(R.material.name);for(let V=0;V<B;V++){let q=[0,1,2].map(d=>H?H.getX(V*3+d):V*3+d),[I,Z,z]=q.map(d=>new j().fromBufferAttribute(C,d).applyMatrix4(R.matrixWorld));if((I.y+Z.y+z.y)/3<Pe.minY)continue;let $=new j().subVectors(Z,I).cross(new j().subVectors(z,I)),X=$.length()/2;X<1e-5||($.normalize(),a.push({a:I,b:Z,c:z,n:$,area:X,see:F?F.getX(q[0]):0,colour:k,core:W}),n+=X)}}let i=un(a,e),l=new Set(r.map(R=>R.material));for(let R of l)R.color.multiplyScalar(.62);let c=Math.min(Pe.max,Math.round(n*Pe.perM2));if(!c)return null;let s=He(5),u=[],f=0;for(let R of a)u.push(f+=R.area);let A=new ca(1,1);A.translate(0,.3,0);let E=new Float32Array(c*3),v=new Float32Array(c),h=new Float32Array(c),x=new Ct({map:tn(e.cache),alphaTest:.45,side:Mt,roughness:.75,metalness:0,alphaToCoverage:!0,name:"env_leaves"});e.seeThrough(x);let b=new _t(A,x,c),P=new ge,S=new rt,m=new rt,w=new j,p=new j,T=new j(0,0,1),N=new j(0,1,0),y=new j,O=new K;for(let R=0;R<c;R++){let g=s()*f,C=0,F=u.length-1;for(;C<F;){let I=C+F>>1;u[I]<g?C=I+1:F=I}let H=a[C],B=s(),k=s();B+k>1&&(B=1-B,k=1-k),p.copy(H.a).addScaledVector(y.subVectors(H.b,H.a),B).addScaledVector(y.subVectors(H.c,H.a),k),p.addScaledVector(H.n,(s()-.3)*.35);let W=y.copy(H.n).lerp(N,.25).normalize();S.setFromUnitVectors(T,W),S.multiply(m.setFromAxisAngle(T,s()*Math.PI*2)),S.multiply(m.setFromAxisAngle(new j(1,0,0),(s()-.5)*1.1));let V=Pe.size[0]+s()*(Pe.size[1]-Pe.size[0]);w.set(V,V,V),P.compose(p,S,w),b.setMatrixAt(R,P);let q=H.n.clone().applyQuaternion(S.clone().invert());E.set([q.x,q.y,q.z],R*3),v[R]=H.see,h[R]=s()*6.2832,O.copy(H.colour).multiplyScalar(1.25+s()*.6),O.offsetHSL((s()-.5)*.03,0,0),b.setColorAt(R,O)}return A.setAttribute("aLeafN",new De(E,3)),A.setAttribute("aSeeId",new De(v,1)),A.setAttribute("aPhase",new De(h,1)),Ft(x,"leaves",R=>{Object.assign(R.uniforms,t),R.vertexShader=ne(R.vertexShader,"void main() {",`attribute vec3 aLeafN;
attribute float aSeeId;
attribute float aPhase;
uniform float envTime;
uniform vec2 envWind;
`,"before"),R.vertexShader=ne(R.vertexShader,"#include <beginnormal_vertex>",`
  objectNormal = normalize(mix(objectNormal, aLeafN, 0.85));`),R.vertexShader=ne(R.vertexShader,"#include <project_vertex>",`vec4 mvPosition = vec4(transformed, 1.0);
  mvPosition = instanceMatrix * mvPosition;
  {
    // wind: the crown sways as a whole (world position), each cluster flutters on its own
    vec3 lw = instanceMatrix[3].xyz;
    float sway = sin(envTime * 0.9 + dot(lw.xz, vec2(0.07, 0.05))) * 0.12 + sin(envTime * 2.3 + aPhase) * 0.05;
    float flutter = sin(envTime * 4.1 + aPhase * 1.7) * 0.04 * uv.y;
    mvPosition.xz += envWind * (sway + flutter) * (0.5 + uv.y);
    mvPosition.y += flutter * 0.5;
  }
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`,"replace"),R.vertexShader=R.vertexShader.replace(`vStId = ${e.seeAttr};`,"vStId = aSeeId;"),R.fragmentShader=ne(R.fragmentShader,"#include <normal_fragment_begin>",`
#ifdef DOUBLE_SIDED
  normal *= faceDirection;
#endif`)}),b.instanceMatrix.needsUpdate=!0,b.instanceColor&&(b.instanceColor.needsUpdate=!0),b.name="env_leaves",b.castShadow=!1,b.receiveShadow=!0,b.frustumCulled=!1,b.computeBoundingSphere(),o.add(b),e.aoHidden.push(x),i&&(o.add(i),b.userData.core=i),b.userData.restore=()=>{for(let R of l)R.color.multiplyScalar(1/.62)},b}function un(o,e){let t=new Map;for(let m of o){if(m.see<Ka)continue;let w=t.get(m.see);w||t.set(m.see,w={box:new ot,colour:null}),w.box.expandByPoint(m.a).expandByPoint(m.b).expandByPoint(m.c),m.core&&!w.colour&&(w.colour=m.colour)}let r=[...t].filter(([,m])=>m.colour);if(!r.length)return null;let a=new la(1,zt.detail),n=a.getAttribute("position"),i=a.getAttribute("normal"),l=new j;for(let m=0;m<n.count;m++){l.fromBufferAttribute(n,m).normalize(),i.setXYZ(m,l.x,l.y,l.z);let w=.9+.2*Ke(Math.round(l.x*97),Math.round(l.z*97)+Math.round(l.y*89)*131,3);n.setXYZ(m,l.x*w,l.y*w,l.z*w)}let c=new Ct({roughness:.9,metalness:0,name:"env_canopy_core"});e.seeThrough(c),Ft(c,"canopy-core",m=>{m.vertexShader=ne(m.vertexShader,"void main() {",`attribute float aSeeId;
`,"before"),m.vertexShader=m.vertexShader.replace(`vStId = ${e.seeAttr};`,"vStId = aSeeId;")});let s=new _t(a,c,r.length),u=new Float32Array(r.length),f=new ge,A=new rt,E=new j(0,1,0),v=new j,h=new j,x=new K,[b,P,S]=zt.radius;return r.forEach(([m,w],p)=>{w.box.getCenter(v),w.box.getSize(h).multiplyScalar(.5),A.setFromAxisAngle(E,m*2.399%(Math.PI*2)),f.compose(v,A,h.set(h.x*b,h.y*P,h.z*S)),s.setMatrixAt(p,f),s.setColorAt(p,x.copy(w.colour).multiplyScalar(zt.shade)),u[p]=m}),a.setAttribute("aSeeId",new De(u,1)),s.instanceMatrix.needsUpdate=!0,s.instanceColor&&(s.instanceColor.needsUpdate=!0),s.name="env_canopy_core",s.castShadow=!1,s.receiveShadow=!0,s.computeBoundingSphere(),s}function fn(o,e,t,r,a,n,i){let l=e.sky?o.getObjectByName(e.sky):void 0;l&&(l.visible=!1);let c={envTime:r.envTime,uZenith:{value:new K},uHorizon:{value:new K},uGround:{value:new K},uSunDir:{value:new j(0,1,0)},uSunColor:{value:new K},uEvening:{value:0},uMacro:{value:i().macro}},s=new te({name:"env_sky",uniforms:c,side:Bt,depthWrite:!1,fog:!1,vertexShader:`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,fragmentShader:`
uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor;
uniform float envTime, uEvening;
uniform sampler2D uMacro;
varying vec3 vDir;
${sn}
void main() {
  vec3 d = normalize(vDir);
  float el = d.y;
  vec3 col = el >= 0.0 ? mix(uHorizon, uZenith, pow(smoothstep(0.0, 1.0, el), 0.5)) : mix(uHorizon, uGround, smoothstep(0.0, -0.25, el));
  float mu = max(dot(d, normalize(uSunDir)), 0.0);
  float sunL = max(max(uSunColor.r, uSunColor.g), max(uSunColor.b, 1e-3));
  vec3 sunTint = uSunColor / sunL;
  // the glow round the sun, wider and warmer low in the evening, and a warm band on its side of the horizon
  col += sunTint * (0.05 * pow(mu, 6.0) + 0.18 * pow(mu, 48.0)) * (1.0 + uEvening * 1.5);
  col += sunTint * uEvening * 0.18 * pow(mu, 2.0) * (1.0 - smoothstep(0.0, 0.35, abs(el)));
  // the disc (HDR: the bloom rounds it)
  col += sunTint * smoothstep(0.99935, 0.99965, mu) * 12.0;
  // wisps: noise on a plane above, drifting; lit toward the sun
  if (el > 0.0) {
    vec2 cp = d.xz / (el + 0.15) * 0.22 + vec2(envTime * 0.0035, envTime * 0.0011);
    float c = texture2D(uMacro, cp).r * 0.6 + texture2D(uMacro, cp * 2.7 + 0.3).g * 0.3 + texture2D(uMacro, cp * 7.1).b * 0.1;
    float cover = smoothstep(0.5, 0.78, c) * smoothstep(0.02, 0.22, el) * 0.7;
    float hl = dot(uHorizon, vec3(0.2126, 0.7152, 0.0722));
    vec3 cloud = mix(vec3(hl * 1.25), sunTint * hl * 1.5, 0.35 + 0.4 * uEvening) + sunTint * 0.35 * pow(mu, 4.0);
    col = mix(col, cloud, cover);
  }
  col += (envHash(gl_FragCoord.xy) - 0.5) / 255.0; // no banding in the gradient
  gl_FragColor = vec4(col, 1.0);
}`}),u=new je(new ua(900,48,24),s);u.name="env_sky",u.renderOrder=-2,u.frustumCulled=!1,u.castShadow=u.receiveShadow=!1,o.add(u),a.aoHidden.push(s);let f=-1;n.push((A,E,v,h)=>{u.position.copy(A.position),u.updateMatrixWorld();let x=t();!x||x.version===f||(f=x.version,c.uZenith.value.copy(x.zenith),c.uHorizon.value.copy(x.horizon),c.uGround.value.copy(x.ground),c.uSunDir.value.copy(x.sun),c.uSunColor.value.copy(x.sunColor),c.uEvening.value=h)})}function dn(o,e,t,r){let a={value:1};r.push((f,A,E,v)=>{a.value=1-.75*v});let n=He(33),i=new Q,l=f=>{let A=new Float32Array(f*4);for(let E=0;E<A.length;E++)A[E]=n();return A},c=(f,A,E,v,h,x)=>{let b=new it;b.setAttribute("position",new Dt(new Float32Array(A*3),3)),b.setAttribute("aSeed",new Dt(l(A),4));let P=new te({name:f,uniforms:{...e,uPx:{value:1},...h},vertexShader:`attribute vec4 aSeed;
uniform float envTime, uPx;
uniform vec2 envCenter, envWind;
varying vec4 vP;
${E}`,fragmentShader:`varying vec4 vP;
${v}`,transparent:!0,depthWrite:!1,blending:x}),S=new sa(b,P);S.name=f,S.frustumCulled=!1,S.onBeforeRender=m=>{P.uniforms.uPx.value=m.getDrawingBufferSize(i).y/720},o.add(S),t.aoHidden.push(P)};c("env_dust",520,`
void main() {
  float t = envTime;
  vec2 o = aSeed.xy * 16.0 + envWind * t * (0.15 + 0.2 * aSeed.z) + vec2(sin(t * 0.3 + aSeed.w * 6.28), cos(t * 0.23 + aSeed.z * 6.28)) * 0.4;
  vec2 p = o + 16.0 * floor((envCenter - o) / 16.0 + 0.5);
  float y = 0.3 + aSeed.z * 3.2 + sin(t * 0.4 + aSeed.x * 12.0) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p.x, y, p.y, 1.0);
  gl_Position = projectionMatrix * mv;
  float fade = 1.0 - smoothstep(5.0, 8.0, distance(p, envCenter));
  gl_PointSize = uPx * (1.5 + aSeed.w * 2.0) * 22.0 / -mv.z;
  vP = vec4(fade * (0.5 + 0.5 * sin(t * 1.3 + aSeed.x * 40.0)), 0.0, 0.0, 0.0);
}`,`
uniform float uDay;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, r) * vP.x * 0.55 * uDay;
  gl_FragColor = vec4(vec3(1.0, 0.92, 0.75) * a, a);
}`,{uDay:a},tt);let s=o.getObjectByName("noodle_shop");if(s){let f=s.position.clone().add(new j(-.7,1.2,1.5));c("env_steam",160,`
uniform vec3 uAt;
void main() {
  float life = fract(envTime * 0.22 + aSeed.x);
  vec3 p = uAt + vec3((aSeed.y - 0.5) * 0.5, 0.0, (aSeed.z - 0.5) * 0.3);
  p.y += life * 1.6;
  p.xz += (envWind * 0.35 + vec2(sin(envTime * 1.1 + aSeed.w * 6.28), cos(envTime * 0.9 + aSeed.y * 6.28)) * 0.12) * life * life * 1.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * (0.25 + life * 0.7) * 700.0 / -mv.z;
  vP = vec4(smoothstep(0.0, 0.12, life) * (1.0 - life), aSeed.w, 0.0, 0.0);
}`,`
uniform float uDay;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r) * vP.x * 0.16;
  gl_FragColor = vec4(vec3(0.96, 0.95, 0.93) * uDay, a);
}`,{uAt:{value:f},uDay:a},St)}let u=o.getObjectByName("great_tree");u&&c("env_falling_leaves",70,`
uniform vec3 uAt;
void main() {
  float life = fract(envTime * 0.045 + aSeed.x);
  float a = aSeed.y * 6.2832 + envTime * (0.3 + aSeed.z * 0.3);
  float rad = 2.5 + aSeed.w * 8.0;
  vec3 p = uAt + vec3(cos(aSeed.y * 6.2832) * rad, 0.0, sin(aSeed.y * 6.2832) * rad);
  p.y += 11.0 * (1.0 - life) + 0.05;
  p.xz += vec2(cos(a), sin(a)) * 0.6 + envWind * life * 3.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPx * 120.0 / -mv.z;
  vP = vec4(smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.95, 1.0, life)), envTime * (1.0 + aSeed.z * 2.0) + aSeed.w * 6.28, aSeed.z, 0.0);
}`,`
void main() {
  // a small leaf spinning as it falls (an ellipse in the point sprite)
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vP.y), co = cos(vP.y);
  vec2 q = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
  float e = (q.x * q.x) / 0.06 + (q.y * q.y) / (0.012 + 0.03 * abs(sin(vP.y * 0.7)));
  if (e > 1.0 || vP.x < 0.01) discard;
  gl_FragColor = vec4(mix(vec3(0.1, 0.2, 0.04), vec3(0.36, 0.27, 0.07), vP.z), 1.0);
}`,{uAt:{value:u.position.clone()}},St)}var Ha={colour:new K(1,.07,.02),gain:.9},za={colour:new K(1,.16,.04),gain:2.2};function hn(o){let e=o.userData.asset;return e!==void 0&&!/^lantern/.test(e)?null:o.map?(o.emissiveMap!==o.map&&(o.emissiveMap=o.map,o.needsUpdate=!0),{colour:Ha.colour.clone(),gain:Ha.gain}):{colour:za.colour.clone(),gain:za.gain}}function mn(o){let e=new Map;o.traverse(r=>{let a=r;if(!(!a.isMesh||a.userData.outline||a.isSkinnedMesh))for(let n of Array.isArray(a.material)?a.material:[a.material]){if(!n.isMeshStandardMaterial||e.has(n))continue;let i=n.name,l=null;if(/^lantern_red$/.test(i)){let c=hn(n);c&&(l=c)}else/^glass$/.test(i)?l={colour:new K(1,.6,.28),gain:2.2}:/^sky_blue$/.test(i)&&(l={colour:new K(1,.55,.22),gain:1});l&&e.set(n,{base:n.emissive.clone(),...l})}});let t=-1;return r=>{if(!(Math.abs(r-t)<.001)){t=r;for(let[a,n]of e){if(r<=0){a.emissive.copy(n.base),a.emissiveIntensity=1;continue}a.emissive.copy(n.base).lerp(n.colour,Math.min(1,r*1.5)),a.emissiveIntensity=n.gain*r}}}}var oe={exposure:.9,envIntensity:.45,ao:{radius:.9,distanceExponent:1.4,thickness:1.5,scale:1.1,samples:16,distanceFallOff:1},aoBlend:.9,aoHalf:{samples:8,pdSamples:8},bloom:{threshold:2.4,smooth:1.2,radius:.55,day:.18,evening:.55,downscale:4},grade:{midday:{lift:[.004,.004,.006],gamma:[1,1,1.01],gain:[1.02,1.01,.985],saturation:1.06,vignette:.22},evening:{lift:[0,.012,.03],gamma:[.97,1,1.05],gain:[1,.97,.93],saturation:.88,vignette:.34},grain:.022}};function vn(){return new te({name:"RealLook.aoComposite",uniforms:{tScene:{value:null},tAO:{value:null},tLowDepth:{value:null},tFullDepth:{value:null},lowSize:{value:new Q(1,1)},near:{value:.1},far:{value:1e3},intensity:{value:0}},vertexShader:`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
uniform sampler2D tScene, tAO, tLowDepth, tFullDepth;
uniform vec2 lowSize;
uniform float near, far, intensity;
varying vec2 vUv;
float viewZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
void main() {
  vec4 c = texture2D(tScene, vUv);
  if (intensity <= 0.0) { gl_FragColor = c; return; }
  float dz = viewZ(texture2D(tFullDepth, vUv).x);
  vec2 p = vUv * lowSize - 0.5;
  vec2 f = fract(p);
  vec2 base = (floor(p) + 0.5) / lowSize;
  float ao = 0.0, wsum = 0.0;
  for (int j = 0; j < 2; j++)
    for (int i = 0; i < 2; i++) {
      vec2 uv = base + vec2(float(i), float(j)) / lowSize;
      float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y) + 1e-3;
      float dl = viewZ(texture2D(tLowDepth, uv).x);
      w /= 1e-3 + abs(dl - dz) / max(dz, 1e-3) * 40.0;
      ao += texture2D(tAO, uv).r * w;
      wsum += w;
    }
  ao = wsum > 0.0 ? ao / wsum : 1.0;
  gl_FragColor = vec4(c.rgb * mix(1.0, ao, intensity), c.a);
}`,depthTest:!1,depthWrite:!1})}function pn(){return{uLift:{value:new j},uGamma:{value:new j(1,1,1)},uGain:{value:new j(1,1,1)},uSat:{value:1},uVignette:{value:0},uGrain:{value:0},uSeed:{value:0}}}var gn=`
uniform vec3 uLift, uGamma, uGain;
uniform float uSat, uVignette, uGrain, uSeed;
float envGrainHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`,xn=`
  {
    vec3 c = clamp(gl_FragColor.rgb, 0.0, 1.0);
    c = uGain * (c + uLift * (1.0 - c));
    c = pow(max(c, 0.0), 1.0 / uGamma);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);
    vec2 q = vUv - 0.5;
    c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
    c += (envGrainHash(gl_FragCoord.xy + uSeed) - 0.5) * uGrain;
    gl_FragColor.rgb = clamp(c, 0.0, 1.0);
  }
`;function En(o,e=!1){let a=new Float32Array(8192),n=new K;for(let l=0;l<32;l++){let s=((l+.5)/32-.5)*Math.PI;s>=0?n.copy(o.horizon).lerp(o.zenith,Math.pow(Math.sin(s),.6)):n.copy(o.horizon).lerp(o.ground,Math.min(1,Math.pow(-Math.sin(s),.5)*1.2));for(let u=0;u<64;u++){let f=(l*64+u)*4;if(a[f]=n.r,a[f+1]=n.g,a[f+2]=n.b,a[f+3]=1,!e)continue;let A=((u+.5)/64-.5)*2*Math.PI,E=Math.cos(s),v=Math.max(0,Math.cos(A)*E*o.sun.x+Math.sin(s)*o.sun.y+Math.sin(A)*E*o.sun.z),h=.06*Math.pow(v,4)+.12*Math.pow(v,24),x=Math.max(o.sunColor.r,o.sunColor.g,o.sunColor.b,.001);a[f]+=o.sunColor.r/x*h*(1+o.daylight),a[f+1]+=o.sunColor.g/x*h*(1+o.daylight),a[f+2]+=o.sunColor.b/x*h*(1+o.daylight)}}let i=new xe(a,64,32,ye,Qt);return i.mapping=$t,i.colorSpace=Kt,i.magFilter=be,i.needsUpdate=!0,i}function Sr(o,e,t=[],r={}){let a=new Set(r.env??[]),n=[...t];o.shadowMap.enabled=!0,o.shadowMap.type=Ut,o.toneMapping=at,o.toneMappingExposure=oe.exposure;let i=o.getSize(new Q),l=r.budget??{ao:"full",msaa:4},c=l.ao,s=new ue(1,1,{type:ce,samples:l.msaa,depthTexture:new st(1,1)}),u=new ct(o,new ue(1,1,{type:ce,depthBuffer:!1})),f=new aa,A=new ma,E=new mt(f,A),v=d=>{d.setRenderTarget(s),d.clear(),d.render(E.scene,E.camera)};E.render=d=>v(d);let h=new Ze(f,A,i.x,i.y);h.updateGtaoMaterial(c==="half"?{...oe.ao,samples:oe.aoHalf.samples}:oe.ao),c==="half"&&h.updatePdMaterial({samples:oe.aoHalf.pdSamples}),h.blendIntensity=oe.aoBlend,e(h.normalMaterial);let x=h.setSize.bind(h);h.setSize=(d,M)=>c==="half"?x(Math.max(2,Math.round(d/2)),Math.max(2,Math.round(M/2))):c==="off"?x(2,2):x(d,M);let b=vn(),P=new de(b),S=h;h.render=(d,M)=>{let D=b.uniforms;if(D.tScene.value=s.texture,c!=="off"){for(let J of n)J.visible=!1;try{S._overrideVisibility(),S._renderOverride(d,h.normalMaterial,S.normalRenderTarget,7829503,1),S._restoreVisibility()}finally{for(let J of n)J.visible=!0}let _=h.camera,U=h.gtaoMaterial.uniforms;U.cameraNear.value=_.near,U.cameraFar.value=_.far,U.cameraProjectionMatrix.value.copy(_.projectionMatrix),U.cameraProjectionMatrixInverse.value.copy(_.projectionMatrixInverse),U.cameraWorldMatrix.value.copy(_.matrixWorld),S._renderPass(d,h.gtaoMaterial,S.gtaoRenderTarget,16777215,1),h.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(_.projectionMatrixInverse),S._renderPass(d,h.pdMaterial,S.pdRenderTarget,16777215,1),D.tAO.value=S.pdRenderTarget.texture,D.tLowDepth.value=S.normalRenderTarget.depthTexture,D.tFullDepth.value=s.depthTexture,D.lowSize.value.set(S.pdRenderTarget.width,S.pdRenderTarget.height),D.near.value=_.near,D.far.value=_.far,D.intensity.value=h.blendIntensity}else D.intensity.value=0;d.setRenderTarget(M),P.render(d)},u.addPass(E),u.addPass(h);let m=a.has("bloom")?new Ce(new Q(i.x,i.y),oe.bloom.day,oe.bloom.radius,oe.bloom.threshold):null;if(m){m.highPassUniforms.smoothWidth.value=oe.bloom.smooth;let d=m.setSize.bind(m);m.setSize=(M,D)=>d(Math.max(2,Math.round(M/oe.bloom.downscale)),Math.max(2,Math.round(D/oe.bloom.downscale))),u.addPass(m)}let w=new dt,p=a.has("grade")?{uniforms:pn()}:null;if(p){Object.assign(w.uniforms,p.uniforms);let d=w.material.fragmentShader,M=d.lastIndexOf("}");w.material.fragmentShader=d.slice(0,M).replace("void main() {",`${gn}
void main() {`)+xn+d.slice(M),w.material.needsUpdate=!0}u.addPass(w);let T=l.fxaa?new ht:null,N=T?new ue(1,1,{depthBuffer:!1}):null;if(T&&N){let d=w.render.bind(w);w.render=(_,U,J)=>{w.renderToScreen=!1,d(_,N,J,0,!1)};let M=T.render.bind(T);T.render=(_,U,J,...L)=>M(_,U,N,...L);let D=T.setSize.bind(T);T.setSize=(_,U)=>{N.setSize(_,U),D(_,U)},u.addPass(T)}let y=r.perf??null;y&&(y.wrap(E,"render","colour"),y.wrap(S,"_renderOverride","aoNormal"),y.wrap(h,"render","ao"),m&&y.wrap(m,"render","bloom"),y.wrap(w,"render","output"),T&&y.wrap(T,"render","fxaa"));let O=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;s.setSize(Math.max(1,Math.floor(i.x*o.getPixelRatio())),Math.max(1,Math.floor(i.y*o.getPixelRatio()))),u.setPixelRatio(o.getPixelRatio()),u.setSize(i.x,i.y);let R=new xa(o),g=new WeakMap,C={frameMs:0,frames:0,envBuilds:0,envLayers:[],envBuildMs:0},F=new WeakMap,H={seeThrough:e,seeAttr:r.seeAttr??"seeThru",aoHidden:n,grassDensity:r.grassDensity??1,lite:!!r.lite},B=[],k=performance.now(),W=(d,M,D,_)=>d.set(M[0]+(D[0]-M[0])*_,M[1]+(D[1]-M[1])*_,M[2]+(D[2]-M[2])*_),V=new WeakSet;function q(d){if(V.has(d)||(d.traverse(D=>{let _=D;if(_.isMesh)for(let U of Array.isArray(_.material)?_.material:[_.material])U.userData.interiorBackdropAir&&n.push(U)}),V.add(d)),!a.size||!d.userData.lookSky)return;let M=F.get(d);if(!M){let D=performance.now();M=Na(d,a,H),C.envBuildMs=+(performance.now()-D).toFixed(1),C.envTimings=M.timings,F.set(d,M),B.push(M)}return C.envLayers=M.layers,M}function I(d){let M=d.userData.lookSky;if(!M)return;let D=g.get(d);if(D&&D.version===M.version)return;let _=En(M,a.has("sky")&&!!d.userData.lookGround?.town),U=R.fromEquirectangular(_);_.dispose(),D?.rt.dispose(),g.set(d,{version:M.version,rt:U}),y?.flag("envBuild"),d.environment=U.texture,d.environmentIntensity=oe.envIntensity,C.envBuilds++}let Z=!!m,z=!!p;function $(d,M,D){let _=performance.now();I(d);let U=q(d),J=(_-k)/1e3;y&&y.cpuBegin("env"),U?.update(M,D,J),y&&y.cpuEnd(),U&&(C.grass=U.grass);let L=U?.evening??0;if(m&&(m.strength=oe.bloom.day+(oe.bloom.evening-oe.bloom.day)*L),p&&!z){let G=p.uniforms;G.uLift.value.set(0,0,0),G.uGamma.value.set(1,1,1),G.uGain.value.set(1,1,1),G.uSat.value=1,G.uVignette.value=0,G.uGrain.value=0}else if(p){let G=oe.grade,Y=p.uniforms;W(Y.uLift.value,G.midday.lift,G.evening.lift,L),W(Y.uGamma.value,G.midday.gamma,G.evening.gamma,L),W(Y.uGain.value,G.midday.gain,G.evening.gain,L),Y.uSat.value=G.midday.saturation+(G.evening.saturation-G.midday.saturation)*L,Y.uVignette.value=G.midday.vignette+(G.evening.vignette-G.midday.vignette)*L,Y.uGrain.value=G.grain,Y.uSeed.value=O?0:C.frames%64*7.31}return E.scene=d,E.camera=M,h.scene=d,h.camera=M,d.userData.sunShadow?.draw(o,d,M),u.render(),performance.now()-_}function X(d,M){let D=[];d.traverse(_=>{_.frustumCulled&&(D.push(_),_.frustumCulled=!1)});try{M()}finally{for(let _ of D)_.frustumCulled=!0}}return{stats:C,setAo(d){d!==c&&(c=d,u.setSize(i.x,i.y))},targets:()=>[s,u.renderTarget1,u.renderTarget2,...N?[N]:[],...c==="off"?[]:[S.gtaoRenderTarget,S.pdRenderTarget,S.normalRenderTarget],...m?m.renderTargetsHorizontal.concat(m.renderTargetsVertical):[]],render(d,M,D){let _=$(d,M,D);C.frames++,C.frameMs+=(_-C.frameMs)/Math.min(C.frames,120)},async prepare(d,M,D){await this.prewarm(d,M),r.warm===!1?$(d,M,D):X(d,()=>$(d,M,D))},async prewarm(d,M,D={}){I(d);let _=r.cacheStamp&&a.size&&!F.has(d)?await ba(r.cacheStamp):void 0;_&&(H.cache=_),q(d),_&&(C.envCache={hits:_.hits,misses:_.misses},_.save(),H.cache=void 0),D.compile!==!1&&await o.compileAsync(d,M)},warmFrame(d,M,D){X(d,()=>$(d,M,D))},restrict(d,M){let D=new Set(d);for(let _ of[...a])D.has(_)||a.delete(_);H.grassDensity=M;for(let _ of B)_.restrict(a,M);m&&Z&&!D.has("bloom")&&(Z=!1,m.enabled=!1),z&&!D.has("grade")&&(z=!1),C.envLayers=B.at(-1)?.layers??[]},setSize(d,M,D){i.set(d,M),s.setSize(Math.max(1,Math.floor(d*D)),Math.max(1,Math.floor(M*D))),u.setPixelRatio(D),u.setSize(d,M)}}}export{oe as REAL,vn as aoComposite,Sr as createRealLook};
