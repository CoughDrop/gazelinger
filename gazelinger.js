(function() {
  let eyex;
  let eyetribe;
  let mygaze;

  try {
    eyex = require('eyex');
  } catch(e) { }
  try {
    eyetribe = require('eyetribe');
  } catch(e) { }
  try {
    mygaze = require('mygaze');
  } catch(e) { }
  if(eyex) {
    try {
      eyex.setup();
    } catch(e) {
      eyex = null;
    }
  }
  if(eyetribe) {
    // TODO...
  }
  if(mygaze) {
    // TODO...
  }

  var poll = null;
  var last_linger_ts = null;
  var last_gaze_ts = null;
  var gaze_history = [];
  var callbacks = [];
  var run_callbacks = function(message) {
    callbacks.forEach(function(cb) {
      cb(message);
    });
  };
  var gazelinger = {
    listen: function(callback) {
      if(!poll) {
        poll = window.setInterval(function() {
          if(callbacks.length == 0) { return; }
          var data = null;
          if(eyex && eyex.ping) {
            data = eyex.ping()
          } else if(eyetribe && eyetribe.ping) {
          } else if(mygaze && mygaze.ping) {
          }

          var message = { raw: data };
          message.ts = (new Date()).getTime();

          if(data.end_ts && data.begin_ts && data.end_ts > data.begin_ts && data.end_ts != last_linger_ts) {
            console.log("linger duration " + (data.end_ts - data.begin_ts));
            console.log("time since last " + (data.end_ts - last_linger_ts));
            last_linger_ts = data.end_ts;

            message = { raw: data};
            message.ts = (new Date()).getTime();
            message.screenX = data.data_x; //(data.data_x / ratio) - (window.screenInnerOffsetX || window.screenX);
            message.screenY = data.data_y; // = (data.data_y / ratio) - (window.screenInnerOffsetY || window.screenY);
            message.duration = (data.end_ts - data.begin_ts);
            message.type = 'linger';
            run_callbacks(message);
          }
          if(data.gaze_ts && data.gaze_ts != last_gaze_ts) {
            last_gaze_ts = data.gaze_ts;
            message = { raw: data};
            message.ts = (new Date()).getTime();
            message.screenX = data.gaze_x; //(data.gaze_x / ratio) - (window.screenInnerOffsetX || window.screenX);
            message.screenY = data.gaze_y; //(data.gaze_y / ratio) - (window.screenInnerOffsetY || window.screenY);
            message.type = 'over';
            message.ts = data.gaze_ts;
            run_callbacks(message);

            gaze_history.push({
              x: message.x,
              y: message.y,
              ts: message.ts
            });
          
            // prune based on distance from latest timestamp
            var new_history = [];
            gaze_history.forEach(function (e) { if (last_gaze_ts - e.ts < 200) { new_history.push(e); } });
            gaze_history = new_history;
          
            // find a quick median
            var xs = gaze_history.sort(function (a, b) { return b.x - a.x });
            var midx = xs[Math.ceil(xs.length / 2)];
            var ys = gaze_history.sort(function (a, b) { return b.y - a.y });
            var midy = ys[Math.ceil(ys.length / 2)];
          
            // temporarily remove outliers
            if (midx && midy) {
              midx = midx.x;
              midy = midy.y;
            
              var filtered_history = gaze_history.filter(function (e) { return (Math.abs(e.x - midx) < 50) && (Math.abs(e.y - midy) < 50); });
              if (filtered_history.length > 0) {
                var biggest_dist = 0;
                last_history_ts = gaze_history[0].ts;
                filtered_history.forEach(function (e) { biggest_dist = Math.max(biggest_dist, e.ts - last_history_ts); last_history_ts - e.ts; });
              
                // if there are no significant time gaps, compute a new middle and trigger a linger event
                if (biggest_dist <= 50) {
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
                  run_callbacks(message);
                  gaze_history = gaze_history.slice(4, 50);
                }
              }
            }
          }
        }, 20);
      }
      callbacks.push(callback);
    },
    stop_listening: function() {
      window.clearInterval(poll);
    }
  };
  module.exports = gazelinger;
})();
