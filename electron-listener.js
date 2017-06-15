(function() {
  var req = (window.requireNode || window.require);
  const ipcRenderer = req('electron').ipcRenderer;

  var ratio = window.devicePixelRatio || 1.0;
  var jq = window.jQuery || window.$ || (window.Ember && window.Ember.$);
  var listen_level = 'noisy';

  var delivery_debounce = null;
  var dropped_points = [];
  ipcRenderer.on('eye-gaze-status', function(event, arg) {
    var elem = document;
    var data = JSON.parse(arg);
    var e = jq.Event('eye-gaze-status');
    e.statuses = data;
    e.target = elem;
    jq(e.target).trigger(e);
  });
  ipcRenderer.on('eye-gaze-data', function(event, arg) {
    var elem = document.getElementById('linger');
  
    var data = JSON.parse(arg);
    var current_ratio = (data.scaled === false) ? 1.0 : ratio;
    data.x = (data.screenX / current_ratio) - (window.screenInnerOffsetX || window.screenX);
    data.y = (data.screenY / current_ratio) - (window.screenInnerOffsetY || window.screenY);
    var valid = false;
    if(data.type == 'linger' && listen_level == 'averaged') { valid = true; }
    if(data.type == 'over' && listen_level == 'noisy') { valid = true; }
    if(valid) {
      if(delivery_debounce) {
        dropped_points.push(data);
      } else {
        delivery_debounce = setTimeout(function() {
          delivery_debounce = null;
        }, 75);
        var e = jq.Event('gazelinger'); // TODO: this should really be gazeover for non-linger events
        if(dropped_points.length > 0) {
          for(var idx = 0; idx < dropped_points.length; idx++) {
            data.x = data.x + dropped_points[idx].x;
            data.y = data.y + dropped_points[idx].y;
          }
          data.x = data.x / (dropped_points.length + 1);
          data.y = data.y / (dropped_points.length + 1);
          dropped_points = [];
        }
        e.clientX = data.x;
        e.clientY = data.y;
        e.duration = data.duration;
        e.eyegaze_hardware = data.raw && data.raw.hardware;
        e.ts = data.ts;

        var elem_left = elem && elem.style && elem.style.left;
        if (elem) { elem.style.left = '-1000px'; }
        e.target = document.elementFromPoint(data.x, data.y);
        if (elem) { elem.style.left = elem_left; }

        jq(e.target).trigger(e);
      }
    }
  });
  ipcRenderer.on('eye-gaze-calibrate', function(event, args) {
    var data = JSON.parse(arg);
    if(calibrate_check_callback) {
      calibrate_check_callback(!!arg.calibratable);
    }
  });
  var calibrate_check_callback = null;
  var eye_gaze = {
    listen: function(level) {
      level = level || 'noisy';
      ipcRenderer.send('eye-gaze-subscribe', level);
      listen_level = level;
    },
    stop_listening: function() {
      ipcRenderer.send('eye-gaze-unsubscribe');
    },
    calibrate: function() {
      ipcRenderer.send('eye-gaze-calibrate');
    },
    calibratable: function(cb) {
      calibrate_check_callback = cb;
      ipcRenderer.send('eye-gaze-calibrate-check');
    }
  };
  
  jq(document).on('mousemove touchstart', function(event) {
    if(event.screenX && event.clientX) {
      window.screenInnerOffsetY = event.screenY - event.clientY;
      window.screenInnerOffsetX = event.screenX - event.clientX;
    }
  });
  
  module.exports = eye_gaze;
})()
