// Build automation
// Require sudo npm install -g gulp
// For dev, initiate watch by executing either `gulp` or `gulp watch`

var gulp = require('gulp'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    gutil = require('gulp-util'),
    uglify = require('gulp-uglify'),
    shell = require('gulp-shell'),
    rename = require('gulp-rename'),
    _ = require('underscore'),
    listFiles = require('file-lister'),
    exec = require('child_process').exec;

var path = {
  originalJs: ['./js/']
};

var browserify_fn = function() {
  var bundleThis = function(srcArray)
  {
    _.each(srcArray, function(sourceFile)
    {
      var b = browserify({
        entries: sourceFile,
        debug: false,
      });

      b.bundle()
        .pipe(source(getFileNameFromPath(sourceFile)))
        .pipe(buffer())
        .pipe(gulp.dest('./build/'))
        .pipe(uglify())
        .pipe(rename({
          extname: '.min.js'
        }))
        .pipe(gulp.dest('./build/'))
    });
  };

  listFiles(path.originalJs, function(error, files) {
    if (error) {
        console.log(error);
    } else {
      var filteredList = files.filter(_.bind(checkFileExtension,this,".js"));
      bundleThis(filteredList);
    }});
}

// Dependency task
gulp.task('init_module', function(callback) {
  exec("git submodule update --init && cd html5-common && npm install && cd ..", function(err) {
    if (err) return callback(err);
    callback();
  });
});

// Build All
gulp.task('build', ['init_module'], function () {
  browserify_fn();
});

var checkFileExtension = function(extension, fileName)
{
    if (!fileName || fileName.length < extension.length)
    {
      return false;
    }

    return (fileName.lastIndexOf(extension) == fileName.length - extension.length);
}

var getFileNameFromPath = function(path)
{
  var start = path.lastIndexOf('/') + 1;
  return path.substring(start);
}

// Run tests
gulp.task('test', shell.task(['make test']));

// Initiate a watch
gulp.task('watch', function() {
  gulp.watch(path.scripts, ['browserify']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['build']);
