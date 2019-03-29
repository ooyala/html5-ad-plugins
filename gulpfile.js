/* eslint-disable require-jsdoc */
// Build automation
// Require sudo npm install -g gulp
// For dev, initiate watch by executing either `gulp` or `gulp watch`

const gulp = require('gulp');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const uglify = require('gulp-uglify');
const shell = require('gulp-shell');
const rename = require('gulp-rename');
const _ = require('underscore');
const listFiles = require('file-lister');
const { exec } = require('child_process');
const webserver = require('gulp-webserver');
const babelify = require('babelify');

const pathJs = {
  originalJs: ['./js/'],
};

// Dependency task
gulp.task('init_module', (callback) => {
  exec('git submodule update --init && cd html5-common && npm install && cd ..', (err) => {
    if (err) return callback(err);
    callback();

    return null;
  });
});

const checkFileExtension = function (extension, fileName) {
  if (!fileName || fileName.length < extension.length) {
    return false;
  }

  return (fileName.lastIndexOf(extension) === fileName.length - extension.length);
};

const getFileNameFromPath = function (path) {
  const start = path.lastIndexOf('/') + 1;
  return path.substring(start);
};

const browserifyFn = function () {
  const bundleThis = function (srcArray) {
    _.each(srcArray, (sourceFile) => {
      const b = browserify({
        entries: sourceFile,
        debug: false,
        transform: [babelify],
      });

      b.bundle()
        .pipe(source(getFileNameFromPath(sourceFile)))
        .pipe(buffer())
        .pipe(gulp.dest('./build/'))
        .pipe(uglify())
        .pipe(rename({
          extname: '.min.js',
        }))
        .pipe(gulp.dest('./build/'));
    });
  };

  listFiles(pathJs.originalJs, function (error, files) {
    if (error) {
      console.log(error);
    } else {
      const filteredList = files.filter(_.bind(checkFileExtension, this, '.js'));
      bundleThis(filteredList);
    }
  });
};

// Build All
gulp.task('build', ['init_module'], () => {
  browserifyFn();
});

// Run tests
gulp.task('test', shell.task(['make test']));

// Initiate a watch
gulp.task('watch', () => {
  gulp.watch('js/**/*', ['build']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['build']);

// Run as webserver for debugging purpose
gulp.task('webserver', () => {
  gulp.src('.')
    .pipe(webserver({
      livereload: true,
      directoryListing: true,
      open: true,
      port: 9003,
    }));
});
