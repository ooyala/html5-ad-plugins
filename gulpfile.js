// Build automation
// Require sudo npm install -g gulp
// For dev, initiate watch by executing either `gulp` or `gulp watch`

var gulp = require('gulp'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    gutil = require('gulp-util'),
    sourcemaps = require('gulp-sourcemaps'),
    uglify = require('gulp-uglify'),
    shell = require('gulp-shell'),
    rename = require('gulp-rename');

var path = {
  scripts: ['./js/*.js']
};

// Build All
gulp.task('build', ['publish_min', "publish_debug"]);

gulp.task('publish_min', function() {
  return gulp.src('js/*.js')
    .pipe(uglify())
    .pipe(rename({
      extname: '.min.js'
    }))
    .on('error', gutil.log)
    .pipe(gulp.dest('./build/'));
});

gulp.task('publish_debug', function() {
  return gulp.src('js/*.js')
    .on('error', gutil.log)
    .pipe(gulp.dest('./build/'));
});

// Run tests
gulp.task('test', shell.task(['npm test']));

// Initiate a watch
gulp.task('watch', function() {
  gulp.watch(path.scripts, ['publish_min', 'publish_debug']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['build']);
