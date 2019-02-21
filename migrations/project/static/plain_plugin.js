var Dashboard = Uppy.Dashboard
var uppy = Uppy.Core({
    id: "uppy",
    locale: {
      strings: {
          chooseFile: 'Pick a new avatar',
          browse: 'From Computer',
      }
    },
    autoProceed: false,
    restrictions: {
      maxFileSize: 10000000,
      maxNumberOfFiles: 5,
      allowedFileTypes: ['.mp3', '.m4a',]
    },
  })
  .use(Dashboard, {
    inline: false,
    target: '#drag-drop-area',
    closeAfterFinish: true,
    trigger: '#uppy-select-files',
    proudlyDisplayPoweredByUppy: false,
    metaFields: [
      { id: 'name', name: 'Name', placeholder: 'file name' },
      { id: 'caption', name: 'Caption', placeholder: 'Text that is displayed in mixer' },
      { id: 'description', name: 'Desciption', placeholder: 'What the track is about'}
    ]
  })
  .use(Uppy.Url, {
    target: Dashboard,
    serverUrl: 'https://companion.uppy.io/',
  })
  .use(Uppy.Dropbox, {
      target: Dashboard,
      serverUrl: 'https://companion.uppy.io/',
  })
  .use(Uppy.GoogleDrive, {
        target: Dashboard,
        serverUrl: 'https://companion.uppy.io',
      })
  .use(Uppy.Tus, {endpoint: 'https://master.tus.io/files/'});

uppy.on('complete', (result) => {
  successful = result.successful;
  let failed     = result.failed;
  hideButton();
  loadMixer();
  console.log('Upload complete! We’ve uploaded these files:', successful);
});

uppy.on('upload-success', (file, resp, uploadURL) => {
  filegot = file;
  console.log('File Name : ', file.name);
  console.log('File Upload Url : ', uploadURL);
  console.log('File Label : ', file.meta.caption);
  let parent = document.getElementById('jcmix');
  let child = document.createElement('div')
  child.setAttribute('class', 'track')
  child.setAttribute('data-url', uploadURL);
  if (typeof file.meta.caption === 'undefined'){
    file.meta.caption = file.meta.name;
  }
  if (typeof file.meta.description === 'undefined'){
    file.meta.description = file.meta.name;
  }
  child.setAttribute('data-label', file.name);
  child.setAttribute('data-start-muted', 'false');
  child.setAttribute('data-initial-pan', 0);
  $.ajax({
    url: "/tracks/add/",
    type: "POST",
    data: {
      filename: file.name,
      url: uploadURL,
      caption: file.meta.caption,
      description: file.meta.description
    },
    success: function(resp){
      $('div#response').append(resp.data);
    }
  });
  parent.appendChild(child);
});

function hideButton(){
  document.getElementById("uppy-select-files").style.display = 'none';
}
function loadMixer(){
  //  var element = document.createElement('script');
  //  element.src = "jcmix-v1.0.5.js";
  //  document.body.appendChild(element);
   console.log(window);
   if (typeof window.run === 'function'){
     window.run();
   } else {
     console.log("Can not find JCMIX");
   }
}

