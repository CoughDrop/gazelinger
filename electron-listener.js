(function() {
  var req = (window.requireNode || window.require);
  const ipcRenderer = req('electron').ipcRenderer;

  var ratio = window.devicePixelRatio || 1.0;
  var jq = window.jQuery || window.$ || (window.Ember && window.Ember.$);

  ipcRenderer.on('eye-gaze-data', function(event, arg) {
    var elem = document.getElementById('linger');
  
    var data = JSON.parse(arg);
    data.x = (data.screenX / ratio) - (window.screenInnerOffsetX || window.screenX);
    data.y = (data.screenY / ratio) - (window.screenInnerOffsetY || window.screenY);
    if(data.type == 'linger') {
      var e = jq.Event('gazelinger');
      e.clientX = data.x;
      e.clientY = data.y;
      e.duration = data.duration;
      e.ts = data.ts;

      var elem_left = elem && elem.style && elem.style.left;
      if (elem) { elem.style.left = '-1000px'; }
      e.target = document.elementFromPoint(data.x, data.y);
      if (elem) { elem.style.left = elem_left; }

      jq(e.target).trigger(e);
    }
  });
  var eye_gaze = {
    listen: function() {
      ipcRenderer.send('eye-gaze-subscribe');
    };
    stop_listening: function() {
      ipcRenderer.send('eye-gaze-unsubscribe');
    };
  };
  
  jq(document).on('mousemove touchstart', function(event) {
    if(event.screenX && event.clientX) {
      window.screenInnerOffsetY = event.screenY - event.clientY;
      window.screenInnerOffsetX = event.screenX - event.clientX;
    }
  });
  
  module.exports = eye_gaze;
})()
