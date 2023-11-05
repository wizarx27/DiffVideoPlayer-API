const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser')
var cors = require('cors')

const { v4: uuidv4 } = require('uuid');

const multer = require("multer")

const videoPath = './video/'; // Replace with the actual path to your video file
const thumbnailPath = './thumbnails/'; // Replace with the actual path to your video file

const dataFile = 'data.json';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Replace 'uploads' with the directory where you want to store uploaded files
        let path = file.fieldname === "videoData" ? "video/" : "thumbnails"
        cb(null, path);
    },
    filename: (req, file, cb) => {
        // Rename the file to avoid overwriting and add a timestamp
        const timestamp = Date.now();
        const uniqueId = uuidv4()
        const ext = file.originalname.split('.').pop();
        if (!req.fileInfo){
          req.fileInfo = uniqueId
        }

        cb(null, `${req.fileInfo}.${ext}`);
    }
});

const upload = multer({ storage: storage })

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors())

app.get('/video/watch/:id', (req, res) => {
const id = req.params.id
  const videoFilePath = path.join(__dirname, videoPath,id);

  // Check if the video file exists
  if (!fs.existsSync(videoFilePath)) {
    return res.status(404).send('Video not found');
  }

  const videoSize = fs.statSync(videoFilePath).size;

  // Define the HTTP headers for the response
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;

    const chunkSize = (end - start) + 1;
    const file = fs.createReadStream(videoFilePath, { start, end });

    const headers = {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, headers);
    file.pipe(res);
  } else {
    const headers = {
      'Content-Length': videoSize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(200, headers);
    fs.createReadStream(videoFilePath).pipe(res);
  }
});

app.get('/thumbnail/:id', (req, res) => {
  const id = req.params.id
  const thumbnailFilePath = path.join(__dirname, thumbnailPath,id);

  // Check if the video file exists
  if (!fs.existsSync(thumbnailFilePath)) {
    return res.status(404).send('Thumbnail not found');
  }

  
  const headers = {
    
  };

  res.writeHead(200, headers);
  fs.createReadStream(thumbnailFilePath).pipe(res);
  
});

const cpUpload = upload.fields([{ name: 'videoData', maxCount: 1 }, { name: 'thumbnailData', maxCount: 1 }])

app.post("/upload/video",cpUpload,(req,res,next)=>{
      // console.log(req.files)
    // try{

      if (!req.files.videoData[0] || !req.files.thumbnailData[0]){
        return res.status(400).json({ error: "Video and thumbnail required" });
      }
      const thumbnailData = req.files.thumbnailData[0]
      const {filename:videoFilename} = req.files.videoData[0]
      const {title,description,tags} = JSON.parse(req.body.jsonData)

      if (!title) {
        return res.status(400).json({ error: "Title Empty" });
      }
      
      fs.readFile(dataFile, 'utf8', (err, data) => {
        if (err) {
          return res.status(500).json({ error: 'Error reading data file' });
        }
    
        const items = JSON.parse(data);
        const newItem = { title, description,thumbnail:thumbnailData.filename,video:videoFilename,id:req.fileInfo ,
          like:0,
          comment:[],
          tags
        };
        items.push(newItem);
    
        fs.writeFile(dataFile, JSON.stringify(items, null, 2), (err) => {
          if (err) {
            return res.status(500).json({ error: 'Error writing data file' });
          }
    
          res.status(201).json(newItem);
        });
      });

    // }catch(e){
    //   return res.status(400).json({ error: e });
    // }

    // res.send("Success")
})

app.put("/video/like/:id",(req,res,next)=>{
  const id = req.params.id
  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading data file' });
    }

    const items = JSON.parse(data);

    const trytoUpdateIndex = items.findIndex(e => e.id === id)
    items[trytoUpdateIndex].like += 1
    fs.writeFile(dataFile, JSON.stringify(items, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error writing data file' });
      }

      res.json(items[trytoUpdateIndex]);
    });
    // res.json(items);
  });
     
})


app.post("/video/:id/comment",(req,res,next)=>{
  const id = req.params.id
  const { comment } = req.body
  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading data file' });
    }

    const items = JSON.parse(data);

    const trytoUpdateIndex = items.findIndex(e => e.id === id)
    items[trytoUpdateIndex].comment.push({comment,id:uuidv4(),commentTime:new Date().toISOString()})
    fs.writeFile(dataFile, JSON.stringify(items, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error writing data file' });
      }

      res.json(items[trytoUpdateIndex]);
    });
    // res.json(items);
  });
     
})

app.get('/video/list', (req, res) => {
  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading data file' });
    }

    const items = JSON.parse(data);
    res.json(items);
  });
});


app.get('/video/detail/:id', (req, res) => {
  const id = req.params.id
  fs.readFile(dataFile, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading data file' });
    }

    const items = JSON.parse(data);

    const vDetail = items.find((i)=>i.id === id)
    res.json(vDetail);
  });
});

app.delete('/items/:id', (req, res) => {
    const itemId = parseInt(req.params.id);

    fs.readFile(dataFile, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading data file' });
        }

        const items = JSON.parse(data);
        const itemIndex = items.findIndex((item) => item.id === itemId);

        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const deletedItem = items.splice(itemIndex, 1)[0];

        fs.writeFile(dataFile, JSON.stringify(items, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ error: 'Error writing data file' });
            }

            res.json(deletedItem);
        });
    });
});

app.get('/items', (req, res) => {
    fs.readFile(dataFile, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Error reading data file' });
      }
  
      const items = JSON.parse(data);
      res.json(items);
    });
});

app.listen(8000, () => {
  console.log('Server is running on port 3000');
});
