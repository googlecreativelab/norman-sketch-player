// Copyright 2017 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import 'webvr-polyfill'
import * as THREE from 'THREE'
import work from 'webworkify'
import TWEEN from '@tweenjs/tween.js'
import {EnterVRButton} from 'webvr-ui'
import * as firebase from 'firebase'
import autobind from 'autobind-decorator'
import defaults from './defaults'
import NormanScene from './scene'
import parserWorker from './parser-worker'
import {makeArrow, makeLoadingText, makeConfigPanel, makeNav} from './ui'
import {
  on,
  takeKeys,
  logErr,
  fpsToMs,
  setStyles,
  splitColor,
  isTouch,
  poolSize,
  whenIdle,
  isTouchDevice,
  PI,
  TAU
} from './utils'

let workerN = 0
let instanceN = -1
const instances = {}
let workers

const makeWorkerPool = () => {
  workers = new Array(poolSize).fill().map(() => {
    const worker = work(parserWorker)
    on(worker, 'message', ({data}) => {
      const {compData, instanceN, sceneN, err} = data
      if (err) {
        return instances[instanceN].rejectScene(sceneN, data.err)
      }
      instances[instanceN].buildScene(sceneN, compData)
    })
    return worker
  })
}

export default class NormanPlayer {
  constructor(el, options = {}) {
    if (!workers) {
      makeWorkerPool()
    }

    if (!el || el.nodeType !== 1) {
      throw new Error('need a DOM element')
    }

    this.instanceN = ++instanceN
    instances[this.instanceN] = this
    this.config = {...defaults, ...options}

    this.el = el
    this.el.style.position = 'relative'
    this.el.classList.add(this.config.cssClass)
    setStyles(this.el, {
      fontFamily: 'monospace',
      userSelect: 'none',
      backgroundColor: this.config.fogColor
    })

    this.stagePositions = {
      out: new THREE.Vector3(0, 0, -this.config.offStageDistance),
      in: new THREE.Vector3(0, 0, -this.config.cameraDistance)
    }

    this.scenes = []
    this.tweens = {}
    this.focusedScene = -1
    this.isPlaying = this.config.autoPlay
    this.lastFrameTime = Date.now()
    this.scrubAcc = 0
    this.needsTick = null
    this.frameInterval = fpsToMs(this.config.fps)
    ;['fogColor', 'lineColor', 'invertFogColor', 'invertLineColor'].forEach(
      k => (this.config[k] = new THREE.Color(this.config[k]))
    )

    if (this.config.firebase) {
      firebase.initializeApp(this.config.firebase)
    }

    this.camera = new THREE.PerspectiveCamera(80, 1, 0.005, 10000)
    this.resetCamera()

    this.scene = new THREE.Scene()
    this.scene.background = this.config.fogColor
    this.scene.fog = new THREE.Fog(
      this.config.fogColor,
      this.config.fogNear,
      this.config.fogFar
    )
    this.renderer = new THREE.WebGLRenderer({antialias: false})
    if (this.config.allowRetina) {
      this.renderer.setPixelRatio(window.devicePixelRatio)
    }

    this.el.appendChild(this.renderer.domElement)

    if (this.config.sceneIds && !Array.isArray(this.config.sceneIds)) {
      this.sceneScales = Object.values(this.config.sceneIds).map(
        v => v.scale || 1
      )
    }

    if (this.config.firebase) {
      this.loadList()
        .then(list => {
          this.sceneList = takeKeys(
            list,
            this.config.sceneIds && Object.keys(this.config.sceneIds).length
              ? this.sceneScales
                ? Object.keys(this.config.sceneIds)
                : this.config.sceneIds
              : Object.keys(list)
          )
          this.setupScenes()
        })
        .catch(e => logErr('loading failed', e))
    } else {
      this.sceneList = Object.entries(
        this.config.sceneIds
      ).reduce((a, [k, v]) => {
        a[k] = v.url[0] === '/' ? window.location.href + v.url : v.url
        return a
      }, {})
      this.setupScenes()
    }

    const keyFns = {
      // enter
      [13]: this.togglePlay,
      // left
      [37]: this.showPrev,
      // right
      [39]: this.showNext
    }

    if (isTouchDevice) {
      on(this.renderer.domElement, 'touchstart', this.onPointerDown)
      on(window, 'touchend', this.onPointerUp)
      on(window, 'touchmove', this.onPointerMove)
      on(window, 'deviceorientation', this.onMotion)
    } else {
      on(this.renderer.domElement, 'mousedown', this.onPointerDown)
      on(window, 'mouseup', this.onPointerUp)
      on(window, 'mousemove', this.onPointerMove)
    }

    on(window, 'keydown', ({keyCode}) => keyCode in keyFns && keyFns[keyCode]())
    on(window, 'resize', () => {
      clearTimeout(this.resizeTimeout)
      this.resizeTimeout = setTimeout(this.setSize, 250)
    })

    if (this.config.showLoadingUi) {
      this.loadingEl = this.el.appendChild(makeLoadingText())
    }

    if (this.config.showConfigUi) {
      this.el.appendChild(makeConfigPanel(this))
    }

    if (
      this.config.showNavUi &&
      !(this.config.sceneIds && this.config.sceneIds.length <= 1)
    ) {
      this.navEl = this.el.appendChild(makeNav(this))
    }

    this.vrEnabled = this.config.vrEnabled

    if (this.vrEnabled) {
      this.vrManager = new EnterVRButton(this.renderer.domElement, {
        color: '#aaa',
        disabledOpacity: 0
      })

      this.vrManager
        .getVRDisplay()
        .then(display => {
          if (/cardboard/i.test(display.displayName)) {
            this.isCardboard = true
            const img = new Image()
            img.src =
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAA' +
              'AAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

            img.onload = () => (texture.needsUpdate = true)

            const texture = new THREE.Texture()
            texture.image = img

            const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01)
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true
            })
            this.scene.add(new THREE.Mesh(geometry, material))
          }
          this.renderer.vr.setDevice(display)
        })
        .catch(() => console.log('Norman: WebVR unsupported'))

      this.fakeVr = false

      let origPos
      let origTop
      let origZ
      let origBodyOverflow

      this.vrManager
        .on('enter', async () => {
          if (this.fakeVr) {
            return
          }
          if (this.navEl) {
            this.navEl.style.visibility = 'hidden'
          }
          if (this.isCardboard) {
            const elStyle = window.getComputedStyle(this.el)
            origPos = elStyle.position
            origTop = elStyle.top
            origZ = elStyle.zIndex
            origBodyOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            setStyles(this.el, {position: 'fixed', top: 0, zIndex: 9999})
          }
          this.renderer.vr.enabled = true
          this.scene.fog.near = this.config.fogNear * this.config.vrDistMultiple
          this.scene.fog.far = this.config.fogFar * this.config.vrDistMultiple
          const scene = await this.getScene(this.focusedScene)
          scene.container.position.z =
            this.stagePositions.in.z * this.config.vrDistMultiple
          this.startTimer()
        })
        .on('exit', async () => {
          if (this.fakeVr) {
            return
          }
          if (this.navEl) {
            this.navEl.style.visibility = 'visible'
          }
          if (this.isCardboard) {
            document.body.style.overflow = origBodyOverflow
            setStyles(this.el, {position: origPos, top: origTop, zIndex: origZ})
          }
          this.renderer.vr.enabled = false
          this.scene.fog.near = this.config.fogNear
          this.scene.fog.far = this.config.fogFar
          const scene = await this.getScene(this.focusedScene)
          scene.container.position.z = this.stagePositions.in.z
          this.resetCamera()
          if (!this.config.timerMode) {
            this.stopTimer()
          }
        })
        .on('error', () => {
          if (!this.config.allowFullscreen) {
            return
          }
          const el = this.vrManager.domElement
          const method = ['moz', 'webkit', 'ms', '']
            .map(s => (s ? s + 'RequestFullscreen' : 'requestFullscreen'))
            .find(s => s in el)

          if (method) {
            this.vrManager.enable()
            this.vrManager.setTitle('FULLSCREEN')

            let dimensions

            on(el, 'click', () => {
              dimensions = [this.width, this.height]
              this.el.style.width = '100vw'
              this.el.style.height = '100vh'
              this.el[method]()
            })

            const onFullscreenChange = () => {
              if (
                document.fullscreen === false ||
                document.webkitIsFullScreen === false ||
                document.mozFullScreen === false
              ) {
                this.el.style.width = dimensions[0] + 'px'
                this.el.style.height = dimensions[1] + 'px'
              }
            }

            on(document, 'fullscreenchange', onFullscreenChange)
            on(document, 'webkitfullscreenchange', onFullscreenChange)
            on(document, 'mozfullscreenchange', onFullscreenChange)
            on(document, 'msfullscreenchange', onFullscreenChange)
          }

          this.fakeVr = true
        })

      setStyles(this.vrManager.domElement, {
        position: 'absolute',
        bottom: '2%',
        right: '2%'
      })
      this.el.appendChild(this.vrManager.domElement)
    }

    this.setSize()
    this.renderer.animate(this.render)
  }

  @autobind
  async render() {
    this.renderer.render(this.scene, this.camera)

    if (this.focusedScene === -1) {
      return
    }

    TWEEN.update()

    const now = Date.now()
    const scene = await this.getActiveScene()

    if (
      this.isPlaying &&
      !(this.config.spinScrub && this.isPointerDown) &&
      now - this.lastFrameTime >= this.frameInterval
    ) {
      scene.tick()
      this.lastFrameTime = now
      if (this.needsTick !== null) {
        const scene2 = await this.getScene(this.needsTick)
        scene2.tick()
      }
    }

    if (this.config.autoRotate && !this.isPointerDown) {
      this.rotateScene(scene, this.config.autoRotateSpeed)
    }

    if (this.config.breathing) {
      scene.innerContainer.position.set(0, Math.cos(now / 800) / 200, 0)
    }
  }

  setupScenes() {
    this.sceneCbs = {}
    this.scenes = Object.values(this.sceneList).map((url, i) =>
      (() => {
        let p
        return () => {
          if (!p) {
            p = new Promise((resolve, reject) => {
              this.sceneCbs[i] = [resolve, reject]
              workers[workerN++ % poolSize].postMessage({
                url,
                instanceN: this.instanceN,
                sceneN: i
              })
            })
          }
          return p
        }
      })()
    )
    this.getScene(0).then(this.init)
  }

  buildScene(sceneN, compData) {
    const scene = new NormanScene(compData, {color: this.config.lineColor})
    scene.container.position.copy(this.stagePositions.out)
    if (this.sceneScales) {
      const s = this.sceneScales[sceneN]
      scene.container.scale.set(s, s, s)
    }
    this.scene.add(scene.container)
    this.sceneCbs[sceneN][0](scene)
    delete this.sceneCbs[sceneN]
  }

  rejectScene(sceneN, err) {
    logErr(err)
    this.sceneCbs[sceneN][1](err)
    delete this.sceneCbs[sceneN]
  }

  resetCamera() {
    this.camera.position.set(0, 0, 0)
    this.camera.rotation.set(0, 0, 0)
  }

  setConfig(config) {
    this.config = {...this.config, ...config}
    if (config.fps) {
      this.frameInterval = fpsToMs(config.fps)
    }
  }

  @autobind
  setSize() {
    const style = window.getComputedStyle(this.el)
    ;['width', 'height'].forEach(k => (this[k] = parseInt(style[k], 10)))
    this.renderer.setSize(this.width, this.height)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  play() {
    this.isPlaying = true
  }

  pause() {
    this.isPlaying = false
  }

  getScene(i) {
    return this.scenes[i]()
  }

  getActiveScene() {
    return this.getScene(this.focusedScene)
  }

  getPrevN(n) {
    return n === 0 ? this.scenes.length - 1 : n - 1
  }

  getNextN(n) {
    return n === this.scenes.length - 1 ? 0 : n + 1
  }

  @autobind
  togglePlay() {
    this.isPlaying = !this.isPlaying
  }

  async loadList() {
    const snapshot = await firebase
      .database()
      .ref('animations')
      .once('value')
    return Object.values(snapshot.val()).reduce((a, c) => {
      a[c.filename] = c.downloadURL
      return a
    }, {})
  }

  clearTween(id) {
    if (this.tweens[id]) {
      this.tweens[id].stop()
      delete this.tweens[id]
    }
  }

  startTween(
    id,
    from,
    to,
    duration = 1000,
    {easing, onUpdate, onComplete} = {}
  ) {
    this.clearTween(id)

    const tween = new TWEEN.Tween(from)
      .to(to, duration)
      .easing(easing || TWEEN.Easing.Quadratic.Out)

    if (onUpdate) {
      tween.onUpdate(onUpdate)
    }

    tween.onComplete(() => {
      if (onComplete) {
        onComplete()
      }
      delete this.tweens[id]
    })

    this.tweens[id] = tween
    tween.start()
  }

  @autobind
  onPointerDown(e) {
    if (this.isPointerDown) {
      return
    }

    if (this.isVr()) {
      this.stopTimer()
    }

    this.isPointerDown = true

    if (isTouch(e)) {
      this.lastPointerX = e.touches[0].clientX
    }
    if (this.config.invertOnClick) {
      this.invertColors()
    }
    this.clearTween('snap')
  }

  @autobind
  async onPointerUp(e) {
    if (!this.isPointerDown) {
      return
    }
    this.isPointerDown = false
    this.scrubAcc = 0

    if (this.isVr()) {
      this.startTimer()
    }

    if (this.config.invertOnClick) {
      this.resetColors()
    }

    if (this.config.mouseRotate) {
      const scene = await this.getActiveScene()
      const {y} = scene.container.rotation
      this.startTween(
        'snap',
        scene.container.rotation,
        {y: Math.floor(Math.abs(y) / TAU) * TAU * (y <= 0 ? -1 : 1)},
        1200,
        {easing: TWEEN.Easing.Elastic.Out}
      )
    }
  }

  @autobind
  onPointerMove(e) {
    if (!this.isPointerDown) {
      return
    }

    let delta
    if (isTouch(e)) {
      const {clientX} = e.touches[0]
      delta = -(clientX - this.lastPointerX)
      this.lastPointerX = e.touches[0].clientX
    } else {
      delta = -e.movementX
    }
    this.handleScrub(delta)
  }

  @autobind
  onMotion(e) {
    if (!(this.isPointerDown && this.isVr())) {
      return
    }

    if (this.lastMotion !== undefined) {
      this.handleScrub(
        (e.alpha - this.lastMotion) * this.config.motionScrubMultiplier
      )
    }

    this.lastMotion = e.alpha
  }

  async handleScrub(delta) {
    const scene = await this.getActiveScene()

    if (this.config.mouseRotate) {
      this.rotateScene(scene, delta / window.innerWidth * -TAU)
    }

    this.scrubAcc += delta

    if (
      this.config.spinScrub &&
      Math.abs(this.scrubAcc) > this.config.scrubThresh
    ) {
      scene.tick(this.scrubAcc > 0 ? 1 : -1)
      this.scrubAcc = 0
    }
  }

  rotateScene(scene, delta) {
    scene.container.rotation.y += delta
  }

  invertColors() {
    this.tweenColors(
      this.config.fogColor,
      this.config.invertFogColor,
      this.config.lineColor,
      this.config.invertLineColor
    )
  }

  resetColors() {
    this.tweenColors(
      this.config.invertFogColor,
      this.config.fogColor,
      this.config.invertLineColor,
      this.config.lineColor
    )
  }

  tweenColors(bg1, bg2, fg1, fg2) {
    this.startTween(
      'colors',
      {...splitColor(bg1, 'bg'), ...splitColor(fg1, 'fg')},
      {...splitColor(bg2, 'bg'), ...splitColor(fg2, 'fg')},
      500,
      {
        onUpdate: ({bgr, bgg, bgb, fgr, fgg, fgb}) => {
          const bgColor = new THREE.Color(bgr, bgg, bgb)
          this.scene.background = bgColor
          this.scene.fog.color = bgColor
          NormanScene.setColor(
            this.config.lineColor,
            new THREE.Color(fgr, fgg, fgb)
          )
        }
      }
    )
  }

  @autobind
  init() {
    if (this.loadingEl) {
      this.el.removeChild(this.loadingEl)
    }
    this.showNext()

    if (this.config.timerMode) {
      this.startTimer()
    }
  }

  @autobind
  showNext() {
    this.advanceScene(1)
  }

  @autobind
  showPrev() {
    this.advanceScene(-1)
  }

  async advanceScene(delta) {
    if (this.navLocked) {
      return
    }

    this.navLocked = true

    if (delta === 1) {
      const nextN = this.getNextN(this.focusedScene)
      const nextScene = await this.getScene(nextN)
      this.moveScene(this.focusedScene, 'out')
      this.moveScene(nextN, 'in')
      this.focusedScene = nextN
    } else {
      const prevN = this.getPrevN(this.focusedScene)
      const prevScene = await this.getScene(prevN)
      if (prevScene.container.position.z <= 0) {
        prevScene.container.position.copy(this.stagePositions.out)
      }
      this.moveScene(this.focusedScene, 'out')
      this.moveScene(prevN, 'in')
      this.focusedScene = prevN
    }

    this.navLocked = false
  }

  async moveScene(n, dest) {
    if (n < 0 || n >= this.scenes.length) {
      return
    }

    const {x, y, z} = this.stagePositions[dest]
    const scene = await this.getScene(n)
    const {focusedScene} = this

    if (n !== focusedScene) {
      this.needsTick = n
    }

    this.startTween(
      n,
      scene.container.position,
      {x, y, z: this.isVr() ? z * this.config.vrDistMultiple : z},
      this.config.entranceTime,
      {
        easing: TWEEN.Easing.Quadratic[dest === 'in' ? 'Out' : 'In'],
        onComplete: () => {
          if (dest !== 'in') {
            scene.container.rotation.y = 0
          }
          this.getScene(this.getNextN(n))
          this.getScene(this.getPrevN(n))

          if (n === 0) {
            this.getScene(this.getNextN(this.getNextN(n)))
          }

          if (n !== focusedScene) {
            this.needsTick = null
          }
        }
      }
    )
  }

  startTimer() {
    this.stopTimer()
    this.timer = setInterval(this.showNext, this.config.timerInterval)
  }

  stopTimer() {
    clearInterval(this.timer)
  }

  isVr() {
    return this.vrEnabled && this.vrManager.isPresenting() && !this.fakeVr
  }

  pollControllers(scene) {
    if (!navigator.getGamepads) {
      return false
    }

    const controllers = navigator.getGamepads()

    if (!controllers || !controllers.length) {
      return false
    }

    const gamepad = Array.prototype.slice
      .call(controllers)
      .find(c => c && c.buttons && c.buttons.length)

    if (!gamepad) {
      return false
    }

    if (
      gamepad.pose &&
      gamepad.pose.hasOrientation &&
      gamepad.pose.orientation
    ) {
      const o = gamepad.pose.orientation
      scene.container.rotation.set(o[0], o[1], o[2])
    }

    if (gamepad.axes && gamepad.buttons[0].pressed) {
      if (gamepad.axes[0] > 0) {
        this.showNext()
      } else {
        this.showPrev()
      }
    }
  }
}

if (typeof window === 'object') {
  window.NormanPlayer = NormanPlayer
}
