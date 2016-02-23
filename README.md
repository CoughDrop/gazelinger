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

### Technical Notes

#### Averaging algorithm
- Sample every 20ms
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

Keep in mind that `electron-listener` assumes it's run in the window process and that 
`gazelinger` has been required in the main process with `gazelinger.something` being
called to listen for inter-process communication. It also required jQuery currently.

### License

MIT
