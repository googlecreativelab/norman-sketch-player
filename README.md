# Norman Sketch Player

This library is the counterpart to James Paterson's
[Norman](https://normanvr.com) VR animation tool and acts as an easy way to
embed animated sketches into a website.

The Norman creation tool is open-source
[here](https://github.com/presstube/norman).

Play with James's animated sketches in the player [here](https://normanvr.com).


## Using the library

Instantiate a player by passing a DOM element and a configuration map:

```javascript
const normanPlayer = new NormanPlayer(
  document.getElementById('norman'),
  {/*...*/}
)
```

If you used the Norman authoring tool with Firebase, you can point the player at
your Firebase instance and it will pull in the animations. You can also pass a
`sceneIds` array to only pull specific animations by title:

```javascript
const normanPlayer = new NormanPlayer(
  document.getElementById('norman'),
  {
    firebase: {
      apiKey: '...',
      authDomain: '...',
      databaseURL: '...',
      projectId: '...',
      storageBucket: '...',
      messagingSenderId: '...'
    },
    sceneIds: [
      'shingled-shift-clumps',
      'mulgy-ront-hops',
      'gildered-ront-flops'
    ]
  }
)
```

You can fine tune the scaling of each animation individually if you pass
`sceneIds` as an object literal:

```javascript
sceneIds: {
  'shingled-shift-clumps': {
    scale: 0.8
  },
  'mulgy-ront-hops': {
    scale: 1.1
  },
  'gildered-ront-flops': {
    scale: 1
  }
}
```

You can also forego Firebase and point the player directly at your animation
JSON files:

```javascript
sceneIds: {
  'shingled-shift-clumps': {
    scale: 0.8,
    url: 'https://...'
  },
  'mulgy-ront-hops': {
    scale: 1.1,
    url: 'https://...'
  },
  'gildered-ront-flops': {
    scale: 1,
    url: 'https://...'
  }
}
```

There are many other configuration options. The full set and their defaults are
as follows:

```javascript
{
  // show config panel in player for adjusting some options on the fly:
  showConfigUi: false,
  // show arrow navigation icons:
  showNavUi: true,
  // show loading message:
  showLoadingUi: true,
  // color of animation lines:
  lineColor: '#000',
  // CSS class applied to player element:
  cssClass: 'norman-player',
  // distance of sketches from camera:
  cameraDistance: 0.2,
  // distance of sketches when they recess into fog:
  offStageDistance: 3,
  // distance multiple when viewing in VR:
  vrDistMultiple: 2.5,
  // fog / background color:
  fogColor: '#eee',
  // start of fog fade from camera:
  fogNear: 0.04,
  // end of fog fade from camera:
  fogFar: 0.35,
  // frames per second animation ticks at:
  fps: 30,
  // invert colors on click/touch:
  invertOnClick: true,
  // play animations:
  autoPlay: true,
  // rotate sketches:
  autoRotate: true,
  // speed of rotation:
  autoRotateSpeed: -0.005,
  // rotate sketches by holding mouse / touch:
  mouseRotate: true,
  // manipulate playheads by scrubbing mouse / touch:
  spinScrub: true,
  // scrubbing sensitivity:
  scrubThresh: 25,
  // subtle drifting on y axis:
  breathing: true,
  // fog / background color on inversion:
  invertFogColor: '#333',
  // line color on inversion:
  invertLineColor: '#fff',
  // duration of entrance tween:
  entranceTime: 1200,
  // allow VR viewing:
  vrEnabled: true,
  // allow fullscreen viewing:
  allowFullscreen: true,
  // auto advance on timer:
  timerMode: false,
  // timer interval:
  timerInterval: 5000,
  // when holding button in Cardboard, spinScrub behavior occurs. sensitivity of effect:
  motionScrubMultiplier: 10,
  // enable high DPI rendering:
  allowRetina: false
}
```

## Authors
* [Dan Motzenbecker](https://github.com/dmotz)

## Contributing

For local development, start the compiler and development server:
```
$ npm run dev
```

To build a bundle for production:
```
$ npm run build
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

## Et cetera

N.B.: *This is not an official Google product.*
