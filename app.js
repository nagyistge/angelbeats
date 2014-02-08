
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var mm = require('musicmetadata');
var Sequelize = require('sequelize');
var upload = require('jquery-file-upload-middleware');

if (process.env.HEROKU_POSTGRESQL_GOLD_URL) {
  var match = process.env.HEROKU_POSTGRESQL_GOLD_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  var sequelize = new Sequelize(match[5], match[1], match[2], {
    dialect: 'postgres',
    protocol: 'postgres',
    port: match[4],
    host: match[3],
    logging: true
  });
} else {
  sequelize = new Sequelize('test', 'root', 'pass');
}

var Track = sequelize.define('Track', {
  file: { type: Sequelize.STRING, unique: true },
  name: { type: Sequelize.STRING },
  time: { type: Sequelize.INTEGER },
  artist: { type: Sequelize.STRING },
  album: { type: Sequelize.STRING },
  genre: { type: Sequelize.STRING }
});

sequelize
  .sync()
  .complete(function(err) {
    if (err) {
      console.log('✗ Error occurred while creating the table:', err)
    } else {
      console.log('✓ Sequelize Sync Complete')
    }
  });

upload.configure({
  uploadDir: __dirname + '/public/uploads',
  uploadUrl: '/uploads'
});

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(sass.middleware({ src: path.join(__dirname, 'public') }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.errorHandler());
app.use(function(req, res, next){
  if (req.path.indexOf('uploads') !== -1) {
    // 404 on /uploads/filename
    var track404 = req.path.split('/').slice(-1)[0];
    Track.find({ where: { file: track404 } })
      .success(function (track) {
        if (track) {
          track.destroy()
            .success(function() {
              console.log('deleted - ', track404);
              return res.send( { message: 'Track no longer exists' });
            });
        }
      });
  }
  console.log('404');
  res.send(404, 'Sorry cant find that!');
});

upload.on('error', function (err) {
  if (err) return console.log(err);
});

upload.on('abort', function (fileInfo) {
  console.log('Abborted upload of ' + fileInfo.name);
});

upload.on('end', function (fileInfo) {
  console.log('finished');

  var filePath = path.join(__dirname, 'public', 'uploads', fileInfo.name);

  console.log(fileInfo.name)
  console.log(fileInfo.originalName)
  if (fileInfo.name !== fileInfo.originalName) {
    console.log('dup file');
    fs.unlink(filePath);
  } else {
    console.log('new file');

    console.log('Getting metadata...');

    var parser = mm(fs.createReadStream(filePath), { duration: true });

    parser.on('metadata', function(meta) {
      console.log('ON META!===')

      Track
        .sync()
        .on('success', function () {
          Track.create({
            file: fileInfo.name,
            name: meta.title,
            time: meta.duration,
            artist: _.first(meta.artist),
            album: meta.album,
            genre: _.first(meta.genre)
          })
            .success(function (track, created) {
              console.log('Successfully created a new track');
            })
            .error(function (err) {
              console.log(err);
            })
        });
    });

    parser.on('error', function(err) {
      console.log('Oops:', err.message)
    });
  }

});

app.get('/', routes.index);
app.get('/users', user.list);
