module.exports = function(grunt) {
  var watchChanged = {}
  if (grunt.file.exists('watchChanged.json')) {
    watchChanged = grunt.file.readJSON('watchChanged.json')
  }
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    react: { // just for jsxhint, production transform is done
             // by browserify
      dynamic_mappings: {
        files: [
          {
            expand: true,
            cwd: 'page/jsx',
            src: ['*.jsx'],
            dest: 'tmp/jsx',
            ext: '.js'
          }
        ]
      }
    },
    jshint: {
      changed : [],
      js: ['Gruntfile.js', 'lib/*.js', 'page/js/*.js', 'tests/*.js'],
      jsx : ['tmp/jsx/*.js'],
      options: {
        "browser": true,
        "globals": {
          "React" : true,
          "CodeMirror" : true,
          "confirm" : true
        },
        "node" : true,
        "asi" : true,
        "globalstrict": false,
        "quotmark": false,
        "smarttabs": true,
        "trailing": false,
        "undef": true,
        "unused": false
      }
    },
    node_tap: {
      all: {
          options: {
              outputType: 'failures', // tap, failures, stats
              outputTo: 'console' // or file
              // outputFilePath: '/tmp/out.log' // path for output file,
              // only makes sense with outputTo 'file'
          },
          files: {
              'tests': ['tests/*.js']
          }
      },
      changed: {
          options: {
              outputType: 'tap', // tap, failures, stats
              outputTo: 'console' // or file
              // outputFilePath: '/tmp/out.log' // path for output file,
              // only makes sense with outputTo 'file'
          },
          files: {
              'tests': watchChanged.node_tap || []
          }
      }
    },
    copy: {
      assets: {
        files: [
          // includes files within path
          {expand: true, cwd: 'page/', src: ['*'], dest: 'build/', filter: 'isFile'},

          // includes files within path and its sub-directories
          {expand: true, cwd: 'page/static', src: ['*.js', '*.jpg', '*.css'], dest: 'build/'}

          // makes all src relative to cwd
          // {expand: true, cwd: 'path/', src: ['**'], dest: 'dest/'},

          // flattens results to a single level
          // {expand: true, flatten: true, src: ['path/**'], dest: 'dest/', filter: 'isFile'}
        ]
      }
    },
    browserify:     {
      options:      {
        debug : true,
        transform:  [ require('grunt-react').browserify ]
      },
      app:          {
        src: 'page/js/main.js',
        dest: 'build/bundle.js'
      }
    },
    uglify: {
      options: {
        mangle: false,
        compress : {
          unused : false
        },
        beautify : {
          ascii_only : true
        }
      },
      assets: {
        files: {
          // 'build/bundle.min.js': ['build/bundle.js'],
          'build/vendor.min.js': ['page/vendor/*.js']
        }
      }
    },
    imageEmbed: {
      dist: {
        src: [ "page/static/base.css" ],
        dest: "build/base.css",
        options: {
          deleteAfterEncoding : false
        }
      }
    },
    staticinline: {
      main: {
        files: {
          'build/index.html': 'build/index.html',
        }
      }
    },
    express: {
      options: {
        // Override defaults here
        delay : 100,
        // background: false,
        debug: true
      },
      dev: {
        options: {
          script: 'lib/server.js'
        }
      }
    },
    watch: {
      scripts: {
        files: ['Gruntfile.js', 'lib/**/*.js', 'page/js/*.js'],
        tasks: ['jshint:changed', 'default'],
        options: {
          spawn: false,
        },
      },
      jsx: {
        files: ['page/jsx/*.jsx'],
        tasks: ['jsxhint', 'default'],
        options: {
          spawn: false,
        },
      },
      other : {
        files: ['page/**/*'],
        tasks: ['default'],
        options: {
          spawn: false,
        },
      },
      tests : {
        files: ['tests/*.js'],
        tasks: ['jshint:js', 'node_tap:changed', 'default'],
        options: {
          interrupt: true,
        },
      },
      express: {
        files:  [ 'lib/**/*.js' ],
        tasks:  [ 'express:dev' ],
        options: {
          spawn: false
        }
      }
    },
    notify: {
      "watch": {
        options: {
          message: 'Assets compiled.', //required
        }
      }
    }
  })
  grunt.loadNpmTasks('grunt-newer');
  grunt.loadNpmTasks('grunt-browserify')
  grunt.loadNpmTasks('grunt-react');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-node-tap');
  grunt.loadNpmTasks('grunt-static-inline');
  grunt.loadNpmTasks("grunt-image-embed");
  grunt.loadNpmTasks('grunt-express-server');
  grunt.loadNpmTasks('grunt-notify');

  grunt.registerTask('jsxhint', ['newer:react', 'jshint:jsx']);
  grunt.registerTask('default', ['jshint:js', 'jsxhint', 'node_tap:all', 'copy:assets', 'browserify', 'imageEmbed','uglify','notify']);

  grunt.registerTask("dev", ["default", 'express:dev', 'watch'])

  grunt.event.on('watch', function(action, filepath) {
    // for (var key in require.cache) {delete require.cache[key];}
    grunt.config('jshint.changed', [filepath]);
    grunt.file.write("watchChanged.json", JSON.stringify({
      node_tap : [filepath]
    }))
    grunt.config('node_tap.changed.files.tests', [filepath]);
  });
};
