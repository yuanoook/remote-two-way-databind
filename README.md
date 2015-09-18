# Twrdb.js
## Remote-two-way-databind
*More powerful databind with remote devices，not just databind in single web page.*

##Have a look first
DEMO: [http://twrdb.coding.io/index.html](http://twrdb.coding.io/index.html) 
Please open two or more Browser windows to feel it.

![Twrdb.js](https://raw.githubusercontent.com/yuanoook/remote-two-way-databind/master/twrdb.demo.png)

## How to use it?
### Server side
	
    put your files like this
    	  
    ├── appDir
    	     ├── twrdb.server.js
    	     ├── index.html
    	     ├── twerdb.client.js
     


----------


	//Run it, just a lightly file && websocket server
	
    node twrdb.server.js

### Client side [ index.html ]

     
#### html

    <script src="twrdb.client.js"></script>

    <div rg-contoller="twrdbCtrl">
        <input rg-model = "localDataKey">
        <p>{{ localDataKey }}</p>
    </div>

#### javascript     
 
	 //Use $ like Jquery to run
     $(function(){
     
		 //Just like Angularjs outside
		 App.controller('twrdbCtrl',function($scope){
	       
		     //Easy to use with $connect
		     $scope.$connect('localDataKey', 'remoteDataKey');
		 });
	
     });

Created by [Rango](http://yuanoook.com) 
Email : yuanoook@foxmail.com
