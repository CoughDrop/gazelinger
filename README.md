## Gaze-linger

Gaze-linger is a node module created to support the CoughDrop Electron app, but it should
work in other node settings as well. Basically Gaze-linger listens for eye gaze events
from the eye-tracking libraries that we have also built modules for. When events come in,
it averages them out and uses them to create "linger" events, which are slices of time
where the eye lingers momentarily (say, 200ms) on the same point. These events can be
passed to a listener for more handling.

Gaze-linger also comes with a listener script `electron-listener.js` which can be run within the app window
in an Electron app. This listener script resolves any differences in screen ratio between
the native client and the browser, finds the element underneath the linger, and triggers
a `gazelinger` event.

### Installation and Usage

```bash
# install gazelinger
npm install https://github.com/coughdrop/gazelinger.git

# install any compatible eye tracking libraries you want to use
npm install https://github.com/coughdrop/eyex.git
npm install https://github.com/coughdrop/eyetribe.git
```

```
var gazelinger = require('gazelinger');

gazelinger.listen(function(data) {
  console.log(data);
});

gazelinger.stop_listening();
```


### Technical Notes

Without any of the related eye tracking libraries ([coughdrop/eyex](https://github.com/coughdrop/eyex), 
[coughdrop/eyetribe](https://github.com/coughdrop/eyetribe), etc.)
this won't do much since it doesn't do anything on its own. When a supported eye tracker library
is installed and an eye tracker is present, gazelinger polls for eye events and returns them
to the specified callback.

#### Averaging algorithm
- Sample every 50ms
- Prune any samples more than 200ms in the past
- Compute the median of the remaining samples
- Remove any samples more than 50px away from the median
- If there are no gaps larger then 50ms between the remaining samples, consider it a valid linger

#### Handling linger visualizations
You're probably going to want some kind of visualization to appear on-screen identifying
where the current linger event is occurring. However, since `electron-listener` is 
triggering events, it's very likely that the on-screen linger icon will be on top of the
actual DOM element that should be triggered. If you give your linger icon the id of 
`linger` then it will be properly ignored.

```
var listener = require('electron-listener'); // run in electron browser process

listener.listen('noisy'); // default is 'noisy', also accepts 'averaged'

listener.stop_listening();

// this element will automagically be ignored when triggering linger events
var linger = document.getElementById('linger');
document.addEventListener('gazelinger', function(event) {
  var elem = event.target;
  var width = $(elem).width();
  var height = $(elem).height();
  elem.style.left = (event.clientX - (width / 2)) + 'px';
  elem.style.top = (event.clientY - (height / 2)) + 'px';
});
```

Keep in mind that `electron-listener` assumes it's run in the window process with jQuery included
 and that `gazelinger` has been required in the main process with code similar to this:

```
var gazelinger = require('gazelinger');
const ipcMain = require('electron').ipcMain;
var sender = null;

ipcMain.on('eye-gaze-subscribe', function(event, args) {
  sender = event.sender;
  gazelinger.listen(function(data, args[0]) {
    if(sender) {
      sender.send('eye-gaze-data', JSON.stringify(data));
    }
  });
});

ipcMain.on('eye-gaze-unsubscribe', function(event, args) {
  sender = null;
  gazelinger.stop_listening();
});
```

#### Gotchas

The Eyegaze Edge library does not account for pixel density ratios. I haven't found a clean
way to correct for this other than to check for it client-side. So when you get a message
back from gazelinger, make sure to check the `scaled` attribute. If it's explicitly set to
false then the coordinates will not match the coordinates from other libraries unless you
multiple by `window.devicePixelRatio`.


### License

MIT
