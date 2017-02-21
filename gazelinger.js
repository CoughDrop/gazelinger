(function() {
  var eyex;
  var eyetribe;
  var mygaze;
  var eyegaze_edge;
  var pending_edge;
  var available = {};

  try {
    eyex = require('eyex');
  } catch(e) { }
  try {
    eyetribe = require('eyetribe');
  } catch(e) { }
  try {
    mygaze = require('mygaze');
  } catch(e) { }
  try {
    pending_edge = require('eyegaze_edge');
  } catch(e) { }
  if(eyex) {
    try {
      eyex.setup();
      available.eyex = true;
    } catch(e) {
      eyex = null;
    }
  }
  if(eyetribe) {
    try {
      eyetribe.setup();
      available.eyetribe = true;
    } catch(e) {
      eyetribe = null;
    }
  }
  if(mygaze) {
    // TODO...
  }
  if(pending_edge) {
    try {
      pending_edge.setup(function(res) {
        if(res && res.ready) {
          eyegaze_edge = pending_edge;
          available.eyegaze_edge = true;
        }
      });
    } catch(e) {
      pending_edge = null;
    }
  }

  var poll = null;
  var lasts = {};
  var gaze_history = [];
  var callbacks = [];
  var any_averaged = false;
  var run_callbacks = function(message) {
    callbacks.forEach(function(obj) {
      if(message.type == 'over' && obj.level == 'noisy') {
        obj.callback(message);
      } else if(message.type == 'linger' && obj.level == 'averaged') {
        obj.callback(message);
      }
    });
  };
  var gazelinger = {
    available: available,
    listen: function(callback, level) {
      level = level || 'noisy';
      if(level == 'averaged') { any_averaged = true; }
      if(eyetribe && eyetribe.listen) {
        // idempotent
        eyetribe.listen();
      }
      if(eyegaze_edge && eyegaze_edge.listen) {
        // idempotent
        eyegaze_edge.listen();
      }
      if(!poll) {
        var poll = function() {
          if(callbacks.length == 0) { return; }
          var data = {};
          if(eyex && eyex.ping) {
            data.eyex = eyex.ping();
            if(data.eyex && (data.eyex.gaze_ts == 0 || lasts.eyex == data.eyex.gaze_ts)) {
              data.eyex = null;
            } else if(data.eyex) {
              lasts.eyex = data.eyex.gaze_ts;
            }
          }
          if(eyetribe && eyetribe.ping) {
            data.eyetribe = eyetribe.ping();
            if(data.eyetribe && (data.eyetribe.gaze_ts == 0 || lasts.eyetribe == data.eyetribe.gaze_ts)) {
              data.eyetribe = null;
            } else if(data.eyetribe){
              lasts.eyetribe = data.eyetribe.gaze_ts
            }
          }
          if(mygaze && mygaze.ping) {
            // TODO ...
          }
          if(eyegaze_edge && eyegaze_edge.ping) {
            data.eyegaze_edge = eyegaze_edge.ping();
            if(data.eyegaze_edge && (data.eyegaze_edge.gaze_ts == 0 || lasts.eyegaze_edge == data.eyegaze_edge.gaze_ts)) {
              data.eyegaze_edge = null;
            } else if(data.eyegaze_edge) {
              lasts.eyegaze_edge = data.eyegaze_edge.gaze_ts;
            }
          }
          data.result = data.eyex || data.eyetribe || data.mygaze || data.eyegaze_edge || {};
          data = data.result;
          

          var message = { raw: data };
          message.ts = (new Date()).getTime();

          if(data.end_ts && data.begin_ts && data.end_ts > data.begin_ts && data.end_ts != lasts.linger) {
//             console.log("linger duration " + (data.end_ts - data.begin_ts));
//             console.log("time since last " + (data.end_ts - lasts.linger));
            lasts.linger = data.end_ts;

            message = { raw: data};
            message.ts = (new Date()).getTime();
            message.screenX = data.data_x; //(data.data_x / ratio) - (window.screenInnerOffsetX || window.screenX);
            message.screenY = data.data_y; // = (data.data_y / ratio) - (window.screenInnerOffsetY || window.screenY);
            message.duration = (data.end_ts - data.begin_ts);
            message.scaled = data.scaled !== false;
            message.type = 'linger';
//            run_callbacks(message);
          }
          if(data.gaze_ts && data.gaze_ts != lasts.gaze) {
            lasts.gaze = data.gaze_ts;
            message = { raw: data};
            message.ts = (new Date()).getTime();
            message.screenX = data.gaze_x; //(data.gaze_x / ratio) - (window.screenInnerOffsetX || window.screenX);
            message.screenY = data.gaze_y; //(data.gaze_y / ratio) - (window.screenInnerOffsetY || window.screenY);
            message.duration = 50;
            message.scaled = data.scaled !== false;
            message.type = 'over';
            message.ts = data.gaze_ts;
            run_callbacks(message);

            if(any_averaged) {
              gaze_history.push({
                x: message.screenX,
                y: message.screenY,
                ts: message.ts
              });
          
              // prune based on distance from latest timestamp
              var new_history = [];
              gaze_history.forEach(function (e) { if (lasts.gaze - e.ts < 200) { new_history.push(e); } });
              gaze_history = new_history;
          
              // find a quick median
              var xs = gaze_history.sort(function (a, b) { return b.x - a.x });
              var midx = xs[Math.ceil(xs.length / 2)];
              var ys = gaze_history.sort(function (a, b) { return b.y - a.y });
              var midy = ys[Math.ceil(ys.length / 2)];
  
              // won't enter this until there are at least 2 events        
              if (midx && midy) {
                midx = midx.x;
                midy = midy.y;
            
                // temporarily remove outliers
                var filtered_history = gaze_history.filter(function (e) { return (Math.abs(e.x - midx) < 50) && (Math.abs(e.y - midy) < 50); });
                // wait until there are at least 3 clustered events, which means a minimum of 150ms
                if (filtered_history.length > 2) {
                  var biggest_dist = 0;
                  lasts.history = gaze_history[0].ts;
                  filtered_history.forEach(function (e) { biggest_dist = Math.max(biggest_dist, e.ts - lasts.history); lasts.history - e.ts; });
              
                  // if there are no significant time gaps, compute a new middle and trigger a linger event
                  if (biggest_dist <= 60) {
                    var mean_x = 0;
                    var mean_y = 0;
                    filtered_history.forEach(function (e) { mean_x = mean_x + e.x; mean_y = mean_y + e.y; });
                    mean_x = mean_x / filtered_history.length;
                    mean_y = mean_y / filtered_history.length;
                
                    message = { raw: data};
                    message.ts = (new Date()).getTime();
                    message.screenX = mean_x;
                    message.screenY = mean_y;
                    message.type = 'linger';
                    message.duration = filtered_history[filtered_history.length - 1].ts - filtered_history[0].ts;
                    message.scaled = data.scaled !== false;
                    run_callbacks(message);
                    // slicing at index 3 means you will get at most a linger event every 150ms
                    gaze_history = gaze_history.slice(3, 50);
                  }
                }
              }
            }
          }
          // I was using setInterval, but it was causing a queue backlog, I thought this would help.
          setTimeout(poll, 45);
        };
        setTimeout(poll, 45);
      }
      callbacks.push({callback: callback, level: level});
    },
    stop_listening: function() {
      // TODO: support multiple listeners
      callbacks = [];
      any_averaged = false;
      clearTimeout(poll);
      poll = null;
      if(eyetribe && eyetribe.stop_listening) {
        eyetribe.stop_listening();
      }
      if(eyegaze_edge && eyegaze_edge.stop_listening) {
        eyegaze_edge.stop_listening();
      }
    },
    can_calibrate: function() {
      return !!eyegaze_edge;
    },
    calibrate: function() {
      if(eyegaze_edge) {
        eyegaze_edge.calibrate();
      }
    }
  };
  module.exports = gazelinger;
})();
