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

import * as THREE from 'three'
import work from 'webworkify'
import vertexWorker from './vertex-worker'
import {clamp, poolSize} from './utils'

let instanceN = -1
let workerN = 0
const instances = {}
const materials = {}

const getMaterial = color => {
  const key = color instanceof THREE.Color ? '#' + color.getHexString() : color

  if (materials[key]) {
    return materials[key]
  }
  materials[key] = new THREE.LineBasicMaterial({color})
  return materials[key]
}

const workers = new Array(poolSize).fill().map(() => {
  const worker = work(vertexWorker)
  worker.addEventListener('message', ({data}) => {
    const {payload, instanceN, clipN, frameN} = data
    instances[instanceN].handleFrameData(clipN, frameN, payload)
  })
  return worker
})

export default class NormanScene {
  constructor(data, {color}) {
    this.frameIndex = 0
    this.container = new THREE.Group()
    this.innerContainer = new THREE.Group()

    this.container.add(this.innerContainer)

    this.material = getMaterial(color)

    instances[++instanceN] = this

    this.totalFrames = 0
    this.framesDone = 0

    this.clips = data.map((clip, clipN) =>
      clip.map((frame, frameN) => {
        workers[workerN++ % poolSize].postMessage({
          frame,
          instanceN,
          clipN,
          frameN
        })
        this.totalFrames++
        return null
      })
    )
  }

  makeFrame(positions, indices, frameN) {
    const geometry = new THREE.BufferGeometry()

    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.attributes.position.needsUpdate = true

    const mesh = new THREE.LineSegments(geometry, this.material)
    mesh.visible = frameN === 0
    this.innerContainer.add(mesh)
    return mesh
  }

  handleFrameData(clipN, frameN, [positions, indices]) {
    this.clips[clipN][frameN] = this.makeFrame(positions, indices, frameN)
    if (++this.framesDone === this.totalFrames - 1) {
      this.isReady = true
      this.frameIndices = new Array(this.clips.length).fill(0)
      this.frameLimits = this.clips.map(clip => clip.length - 1)
    }
  }

  tick(n = 1) {
    if (!this.ready) {
      return
    }
    this.clips.forEach((clip, i) => {
      const index = this.frameIndices[i]
      const limit = this.frameLimits[i]
      let next = index + n
      next = next > limit ? 0 : next < 0 ? limit : next

      clip[index].visible = false
      clip[next].visible = true
      this.frameIndices[i] = next
    })
  }

  static setColor(id, val) {
    getMaterial(id).color = val
  }

  setFrame(percent) {
    if (!this.ready) {
      return
    }
    const p = clamp(0, 1, percent)
    this.clips.forEach((clip, i) => {
      clip[this.frameIndices[i]].visible = false
      const next = Math.floor(this.frameLimits[i] * p)
      clip[next].visible = true
      this.frameIndices[i] = next
    })
  }
}
