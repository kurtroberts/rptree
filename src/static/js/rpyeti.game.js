var RPYeti = RPYeti || {};

RPYeti.game = (function() {
	var self;

	return {

		/** Public Properties **/
		lastFire: 0,
		startLevel: 0,
		snowballBlockers: [],

		/** Constructor **/

		init: function() {
			// save singleton context
			self = this;

			// game container
			this.container = $('#rpyeti').get( 0 );

			// create renderer and scene
			this.createRenderer();
			this.createScene();

			// create perspective camera
			var fov = ( RPYeti.config.stereo ) ? RPYeti.config.cardboard.fov : RPYeti.config.desktop.fov;
			this.camera = new THREE.PerspectiveCamera( fov, self.container.offsetWidth / self.container.offsetHeight, 0.1, RPYeti.config.terrain.depth );

			// create user controls
			this.controls = RPYeti.controls.init( this );

			// create audio listener
			this.listener = new THREE.AudioListener();
			this.camera.add( this.listener );

			this.player = new RPYeti.Player();
			this.gameplay = new RPYeti.Gameplay(this, this.player, this.camera, this.scene);

			this.clock = new THREE.Clock();

			// create environment
			this.addSnow();
			this.addSky();
			this.addLights();
			this.addExit();

			// add static models
			this.addTrees();
			this.addRocks();
			this.addMounds();
			this.addLogs();
			this.addSigns();
			this.addSnowball();

			self.snowballBlockers = [ self.exit, self.snow, self.projectiles, self.trees, self.rocks, self.mounds, self.logs, self.signs, self.gameplay.yetis ];

			// add game HUD
			if (RPYeti.config.stereo) {
				this.hud = new RPYeti.HUD(this.player, this.camera, this.stereo);
			} else {
				this.hud = new RPYeti.HUD(this.player, this.camera);
			}

			// add sound effects
			this.addSounds();

			// do debug setup
			this.debug();

			// set resize event
			$(window).on('resize', this.resize);
			setTimeout(this.resize, 1);

		},

		start: function() {
			//self.startLevel = 1;

			RPYeti.music.publisher.trigger('rpyeti.music.start');
			self.gameplay.start(self.startLevel, true);
		},

		/** Methods / Callbacks **/

		animate: function(t) {
			var delta = self.clock.getDelta();

			window.requestAnimationFrame( self.animate );
			if( ! self.controls.isHooked ) {
				self.update( delta );
				if( self.controls.state.isFiring && self.player.health > 0 ) {
					if( ( t - self.lastFire ) >= RPYeti.config.snowball.rate ) {
						self.playSound( self.sounds.throw );
						self.throwSnowball(undefined, self.player);
						self.lastFire = t;
					}
				}
			}
			self.render( delta );
		},

		update: function(delta) {
			self.controls.update( delta );
			RPYeti.Character.update( delta );
			self.updateProjectiles( delta );
			TWEEN.update();
			$(self.container).trigger('rpyeti.game.update', delta );
		},

		render: function(dt) {
			if( RPYeti.config.stereo ) {
				self.hud.updateReticleFocus(self.scene);
				self.stereo.render( self.scene, self.camera, self.offset );
			} else {
				self.renderer.render( self.scene, self.camera );
			}
		},

		/** Event Handlers **/

		resize: function() {
			var width = self.container.offsetWidth;
			var height = self.container.offsetHeight;

			self.camera.aspect = width / height;
			self.camera.updateProjectionMatrix();

			if( RPYeti.config.stereo ) {
				self.stereo.setSize( width, height );
				self.offset = (width - RPYeti.config.cardboard.pupillaryBaseline) / 2;
				if (self.offset < 0) { self.offset = 0 }
			} else {
				self.renderer.setSize( width, height );
			}
		},

		/** Engine **/

		createRenderer: function() {
			this.renderer = new THREE.WebGLRenderer({
				antialias: true,
				alpha: true
			});
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			this.renderer.setSize( window.innerWidth, window.innerHeight );
			$(this.container).append( this.renderer.domElement );

			if( RPYeti.config.stereo ) {
				this.stereo = new THREE.StereoEffect( this.renderer );
				this.stereo.focalLength = RPYeti.config.cardboard.focalLength;
				this.stereo.eyeSeparation = RPYeti.config.cardboard.eyeSeparation;
			}
		},

		createScene: function() {
			this.scene = new THREE.Scene();

			if( RPYeti.config.stereo ) {
				this.scene.add( this.stereo.left );
				this.scene.add( this.stereo.right );
			}
		},

		/** Environment **/

		addSnow: function() {
			var texture = RPYeti.loader.textures.snow;
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat = new THREE.Vector2(256, 256);
			texture.anisotropy = self.renderer.getMaxAnisotropy();

			var material = new THREE.MeshPhongMaterial({
				map: texture,
			});

			var size = RPYeti.config.terrain.depth * 2,
				geometry = new THREE.PlaneGeometry(size, size);

			var mesh = new THREE.Mesh( geometry, material );
			mesh.rotation.x = -Math.PI / 2;
			mesh.receiveShadow = true;
			self.snow = mesh;
			self.scene.add( mesh );
		},

		addSky: function() {
			var geometry = new THREE.SphereGeometry(RPYeti.config.terrain.depth, 64, 64),
				material = new THREE.MeshBasicMaterial({
					map: RPYeti.loader.textures.stars,
					side: THREE.BackSide
				}),
				skybox = new THREE.Mesh(geometry, material);
			self.scene.add( skybox );
		},

		addLights: function() {
			var ambient = new THREE.AmbientLight(0x888888);
			self.scene.add( ambient );

			var light = new THREE.HemisphereLight(0xddddff, 0x333355, 0.3);
			self.scene.add( light );

			var directional = new THREE.DirectionalLight( 0xaaddff, 0.6 );
			directional.position.x	= -600;
			directional.position.y	= 600;
			directional.position.z	= -400;
			directional.castShadow = true;
			directional.shadowMapWidth = 512;
			directional.shadowMapHeight = 512;
			directional.target = this.camera;
			//directional.shadowCameraNear = 50;
			//directional.shadowCameraFar = 500;
			//directional.shadowCameraFov = 90;
			self.scene.add( directional );

		},

		addExit: function() {
			var	canvas = document.createElement('canvas'),
				context = canvas.getContext('2d');
			context.width = 512,
			context.height = 256;

			context.fillStyle = '#ffffff';
			context.font = '12pt normal PressStart2P';
			context.fillText('LOADING FONT', 1, 1);

			context.beginPath();
			context.lineWidth = 20;
			context.strokeStyle = '#444400';
			context.rect(0, 0, 300, 150);
			context.fillStyle = '#fff2ec';
			context.fill();
			context.stroke();

			context.shadowColor = '#ff0000';
			context.shadowBlur = 8;
			context.fillStyle = '#e7231f';
			context.font = '36pt normal "Courier New", Courier, monospace';
			context.fillText('EXIT GAME', 20, 90);

			var geometry = new THREE.BoxGeometry( 3.5, 0.2, 1.25 ),
				top = new THREE.MeshBasicMaterial({ map: new THREE.Texture( canvas ), transparent: true }),
				side = new THREE.MeshBasicMaterial({ color: 0x444400 }),
				faces = new THREE.MeshFaceMaterial([ side, side, top, side, side, side ]);

			top.map.needsUpdate = true;

			self.exit = new THREE.Mesh( geometry, faces );
			self.exit.position.set( 0.0, -9.8, -1.7 );
			self.controls.yawGimbal.add( self.exit );
		},

		/** Models **/

		addObjects: function(arr, baseModel, density, group, rotation, scale) {
			rotation = rotation || false;
			scale = scale || 4;

			for (var i = 0; i < arr.length; i++) {
				var model = baseModel.clone(),
					x = arr[i][0] * density,
					z = arr[i][1] * density;
					distance = Math.sqrt(Math.pow(x, 2) + Math.pow(z, 2));

				if (distance < self.camera.far) {
					model.translateX( x );
					model.translateZ( z );
					model.scale.set( scale, scale, scale );

					if (rotation) {
						model.rotateY(Math.random() * Math.PI * 2);
					}

					group.add( model );
				}
			}
		},

		addTrees: function() {
			var trees = RPYeti.loader.maps.main.trees,
				strees = RPYeti.loader.maps.main.strees
				density = RPYeti.loader.maps.main.density;
			self.trees = new THREE.Group();
			self.scene.add( self.trees );

			self.addObjects(trees, RPYeti.loader.models[ 'tree' ], density, self.trees, true);
			self.addObjects(strees, RPYeti.loader.models[ 'snowytree' ], density, self.trees, true);
		},

		addRocks: function() {
			var rocks =  RPYeti.loader.maps.main.rocks,
				srocks = RPYeti.loader.maps.main.srocks,
				density = RPYeti.loader.maps.main.density;

			self.rocks = new THREE.Group();
			self.scene.add( self.rocks );

			self.addObjects(rocks, RPYeti.loader.models[ 'rock' ], density, self.rocks, true);
			self.addObjects(srocks, RPYeti.loader.models[ 'snowyrock' ], density, self.rocks, true);
		},

		addMounds: function() {
			var model = RPYeti.loader.models.mound,
				mounds = RPYeti.loader.maps.main.mounds,
				density = RPYeti.loader.maps.main.density;

			// texture tiling tweak
			model.children[0].children[1].material.map.repeat.set(3, 3);

			self.mounds = new THREE.Group();
			self.scene.add( self.mounds );

			self.addObjects(mounds, model, density, self.mounds, false, 8);
		},

		addLogs: function () {
			var model = RPYeti.loader.models.log,
				logs = RPYeti.loader.maps.main.logs,
				density = RPYeti.loader.maps.main.density;

			self.logs = new THREE.Group();
			self.scene.add( self.logs );

			self.addObjects(logs, model, density, self.logs, true, 6);
		},

		addSigns: function () {
			var model = RPYeti.loader.models.sign,
				signs = RPYeti.loader.maps.main.signs,
				density = RPYeti.loader.maps.main.density,
				cameraPos = self.camera.getWorldPosition();

			self.signs = new THREE.Group();
			self.scene.add( self.signs );

			if (self.signs.children.length > 0) {
				self.addObjects(signs, model, density, self.signs, false);

				cameraPos.y = self.signs.children[0].position.y;
				for (var i in self.signs.children) {
					self.signs.children[i].lookAt(cameraPos);
				};
			}
		},

		/** Sounds **/

		addSounds: function() {
			self.sounds = {};

			// snowball throw sound
			self.sounds.throw = new THREE.Audio( self.listener );
			self.sounds.throw.setBuffer( RPYeti.loader.sounds.player_throw );
			self.sounds.throw.setVolume( RPYeti.config.audio.pointblankVolume );
			self.listener.add( self.sounds.throw );

		},

		playSound: function( sound ) {
			if( sound.isPlaying ) {
				sound.stop();
				sound.isPlaying = false;
			}
			sound.play();
		},

		createSoundEffect: function( sound ) {
			var effect = new THREE.PositionalAudio( self.listener );
			effect.setBuffer( sound );
			effect.setVolume( RPYeti.config.audio.effectVolume );
			effect.setRolloffFactor( RPYeti.config.audio.effectRolloff );
			effect.setMaxDistance( RPYeti.config.snowball.range );
			return effect;
		},

		/** Projectiles **/

		addSnowball: function( ) {
			if (self.projectiles === undefined) {
				self.projectiles = new THREE.Group();
				self.scene.add( self.projectiles );
			}
			var geometry = new THREE.SphereGeometry( RPYeti.config.snowball.size, RPYeti.config.snowball.lod, RPYeti.config.snowball.lod ),
				material = new THREE.MeshPhongMaterial({ map: RPYeti.loader.textures.snowball });
			self.snowball = new THREE.Mesh( geometry, material );
			self.snowball.castShadow = true;
			self.snowball.receiveShadow = true;
			self.snowball.name = 'snowball';
		},


		throwSnowball: function (source, character) {
			self.throwProjectile(source, character, self.snowball);
		},


		throwProjectile: function( source, character, model ) {
			model = model || self.snowball;
			if( ! model ) return;

			var raycaster = new THREE.Raycaster();
			if( source ) {
				raycaster.set( source, self.camera.getWorldPosition().sub(source).normalize() );
			} else {
				raycaster.set( self.camera.getWorldPosition(), self.controls.getDirection() );
			}

			var projectile = model.clone();
			projectile.userData.type = 'projectile'
			projectile.userData.initiator = character;
			projectile.userData.damage = RPYeti.config.snowball.damage;
			projectile.userData.model = model;
			projectile.lookAt(self.camera);
			projectile.ray = raycaster.ray;
			projectile.ray.at( 5.0, projectile.position );
			self.projectiles.add( projectile );
		},

		updateProjectiles: function( delta ) {
			if( self.projectiles ) {
				self.projectiles.traverseVisible(function(projectile) {
					if( projectile.userData && projectile.userData.type === 'projectile' ) {
						var speed = RPYeti.config.snowball.speed * delta,
							dir = projectile.ray.direction;
						projectile.translateX( speed * dir.x );
						projectile.translateY( speed * dir.y );
						projectile.translateZ( speed * dir.z );
						if( projectile.ray.origin.distanceTo( projectile.position ) >= RPYeti.config.snowball.range ) {
							self.removeProjectile( projectile );
						}
						if( projectile.userData.initiator != self.player && projectile.position.distanceTo( self.camera.getWorldPosition() ) <= RPYeti.config.player.hitbox ) {
							self.removeProjectile( projectile, self.player );
						}
						var raycaster = new THREE.Raycaster( projectile.position, dir );
						var collisions = raycaster.intersectObjects( self.snowballBlockers, true );
						for( var i = 0; i < collisions.length; i++ ) {
							if( collisions[i].object != projectile && collisions[i].distance <= ( RPYeti.config.snowball.size * 4 ) ) {
								self.removeProjectile( projectile, collisions[i].object );
							}
						}
					}
				});
			}
		},

		removeProjectile: function( projectile, target ) {
			// avoid duplicate hits
			if (projectile.visible) {
				if (projectile.name === 'snowball') {
					self.explodeSnowball( projectile, ( ! target ) );
				} else if (projectile.userData && projectile.userData.type === 'projectile') {
					self.explodeProjectileModel(projectile, (!target));
				}

				// hide projectile
				projectile.visible = false;

				// play impact sound depending on object struck
				if( target ) {
					var effect;
					if ( target == self.exit && projectile.userData.initiator == self.player) {
						// player hit exit sign, time to go!
						self.exitGame();
						return;
					} else if ( target instanceof RPYeti.Player ) {
						effect = RPYeti.loader.sounds.player_hit;
					} else if ( target == self.snow ) {
						effect = RPYeti.loader.sounds.snow_hit;
					} else if( self.gameplay.yetis.getObjectById( target.id ) ) {
						effect = RPYeti.loader.sounds.yeti_hit;
					} else if( self.projectiles.getObjectById( target.id ) ) {
						var t = target;
						while (t.userData !== undefined && t.userData.type != 'projectile' && t.parent != null) {
							t = t.parent;
						}
						self.removeProjectile( t, true );
						effect = RPYeti.loader.sounds.snow_hit;
					} else if( self.trees.getObjectById( target.id ) ) {
						effect = RPYeti.loader.sounds.tree_hit;
					} else if ( self.rocks.getObjectById( target.id ) || self.logs.getObjectById( target.id ) ) {
						effect = RPYeti.loader.sounds.rock_hit;
					} else if( self.mounds.getObjectById( target.id ) ) {
						effect = RPYeti.loader.sounds.snow_hit;
					} else if( self.gameplay.intro && self.gameplay.intro.getObjectById( target.id ) ) {
						setTimeout(function () {
							var t = target;
							while (t.type != 'Object3D' && t.parent != null) {
								t = t.parent;
							}
							self.player.trigger('intro.select', t.name);
						}, 100);
					}

					if( effect ) {
						var impact = self.createSoundEffect( effect );
						projectile.add( impact );
						impact.play();
					}

					if (target instanceof RPYeti.Character) {
						target.hit(projectile);
					} else if (target.userData && target.userData.character) {
						target.userData.character.hit(projectile);
					}
				}

				// get rid of projectile after delay
				setTimeout( function() {
					self.projectiles.remove( projectile );
				}, 500 );
			}
		},

		explodeSnowball: function( snowball, implode ) {
			var explosion = self.snowball.clone();
			explosion.position.copy( snowball.position );
			explosion.material = new THREE.MeshPhongMaterial({ map: RPYeti.loader.textures.snowburst });
			explosion.material.transparent = true;
			explosion.castShadow = false;
			explosion.receiveShadow = false;
			explosion.name = 'explosion';
			self.scene.add( explosion );
			var explosionTween = new TWEEN.Tween({ scale: explosion.scale.x, opacity: explosion.material.opacity })
				.easing( TWEEN.Easing.Quadratic.Out )
				.onUpdate(function () {
					explosion.scale.set( this.scale, this.scale, this.scale );
					explosion.material.opacity = this.opacity;
				}).onComplete(function () {
					self.scene.remove( explosion );
				});
			if( implode ) {
				explosionTween.to({ scale: 0, opacity: 0 }, 1000 ).start();
			} else {
				explosionTween.to({ scale: 4, opacity: 0 }, 300 ).start();
			}
		},

		// TODO: refactor to consolidate with above
		explodeProjectileModel: function (projectile, implode) {
			var explosion = projectile.userData.model.clone(),
				materials = [],
				opacity = 1;

			explosion.position.copy( projectile.position );

			for (var i in explosion.children) {
				if (explosion.children[i] instanceof THREE.Object3D) {
					for (var m in explosion.children[i].children) {
						if (explosion.children[i].children[m] instanceof THREE.Mesh) {
							explosion.children[i].children[m].material = explosion.children[i].children[m].material.clone();
							materials.push(explosion.children[i].children[m].material);

							explosion.children[i].children[m].material.transparent = true;
							explosion.children[i].children[m].castShadow = false;
							explosion.children[i].children[m].receiveShadow = false
						}
					}
				}
			}

			if (materials.length > 0) {
				opacity = materials[i].opacity;
			}

			explosion.name = 'explosion';
			self.scene.add( explosion );
			var explosionTween = new TWEEN.Tween({ scale: explosion.scale.x, opacity: opacity })
				.easing( TWEEN.Easing.Quadratic.Out )
				.onUpdate(function () {
					explosion.scale.set( this.scale, this.scale, this.scale );
					for (var i in materials) {
						materials[i].opacity = this.opacity;
					}
				}).onComplete(function () {
					self.scene.remove( explosion );
				});
			if( implode ) {
				explosionTween.to({ scale: 0, opacity: 0 }, 1000 ).start();
			} else {
				explosionTween.to({ scale: projectile.scale.x * 4, opacity: 0 }, 300 ).start();
			}
		},

		exitGame: function() {
			// remove yetis and prevent spawning
			self.gameplay.settings.yeti.maxOnScreen = 0;
			self.gameplay.yetis.traverse( function(yeti) {
				if( yeti instanceof THREE.Mesh ) {
					yeti.userData.character.defeat({ userData: { initiator: null } });
				}
			});
			// remove snowballs
			self.projectiles.traverseVisible(function(projectile) {
				if( projectile instanceof THREE.Mesh || projectile instanceof THREE.Group ) {
					self.removeProjectile( projectile );
				}
			});
			// zero health
			self.player.health = 0;
			// turn off music
			RPYeti.music.publisher.trigger('rpyeti.music.mute');
			// display countdown
			var text = self.stereo ? RPYeti.config.text.hud.gameOverVR : RPYeti.config.text.hud.gameOver;
			self.hud.addText( text, 0 );
			self.hud.startCountdown(5, function () {
				location.assign( RPYeti.config.urls.leaderBoard + ( location.hash || '' ) );
			});
		},

		debug: function() {
			if( RPYeti.config.wireframe ) {
				setTimeout(function() {
					self.scene.traverse(function(child) {
						if ( child instanceof THREE.Mesh ) {
							child.material.wireframe = true;
						}
					});
				}, 200);
			}
			if( RPYeti.config.fps ) {
				this.stats = new Stats();
				$(this.stats.domElement).css({ position: 'absolute', top: '0px' });
				$(this.container).append( this.stats.domElement );
				$(this.container).on('rpyeti.game.update', function() {
					self.stats.update();
				});
			}
		},

	};

})();

$(function() {

	$(document).on('rpyeti.loader.complete', function(){

		//TODO: display touch to start message
		var init;
		$(document).on('mouseup touchend', function(e) {
			if( ! init ) {
				init = true;
				RPYeti.game.init();
				RPYeti.game.animate();
				RPYeti.game.start();
			}
		});
	});

});
