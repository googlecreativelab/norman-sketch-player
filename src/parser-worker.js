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

const netErr = 'Network request failed'

export default self =>
  self.addEventListener('message', ({data}) => {
    const {url, instanceN, sceneN} = data

    const handleErr = msg =>
      self.postMessage({err: new Error(msg), instanceN, sceneN})

    const xhr = new XMLHttpRequest()

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const {compData} = JSON.parse(xhr.responseText)
          self.postMessage({compData, instanceN, sceneN})
        } catch (e) {
          self.postMessage({
            err: new Error('JSON parsing failed'),
            instanceN,
            sceneN
          })
        }
      } else {
        handleErr(netErr)
      }
    }

    xhr.onerror = xhr.ontimeout = () => handleErr(netErr)

    xhr.open('GET', url)
    xhr.send()
  })
