var Inferno = (function() {

  function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
  };

  function byString(o, s) {
    if(o == null) {
      return;
    }
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    var a = s.split('.');
    var length = a.length - (a.length === 1 ? 1 : 0);
    for (var i = 0; i < length; ++i) {
      var n = a[i];
      if (n in o) {
          o = o[n];
      } else {
          return;
      }
    }
    return o;
  };

  function Component( data ) {
    //called so byString can come into context (odd Chrome bug)
    byString();

    this._lastChecks = [];
    this._propHasChanged = {};
    this._checkDeps = false;
    this._init = false;
    this._element = data.element;
    this._vDom = null;
    //apply the constructor to this component
    data.constructor.apply(this);
    //go through the new properties and bind them to this component
    this._attachBindings();
    //handle the template
    this._template = data.template.apply(this);
    //do inital update
    this.update();
  };

  Component.prototype._attachBindings = function() {

    var self = this;

    function applyBinding(obj, key, prop, id) {
      //set it to true by default so it gets updated straight away to vDOM
      self._propHasChanged[id] = true;
      //now set the biders on the object
      Object.defineProperty(obj, key, {
        get: function() {
          return prop;
        },
        set: function(val) {
          if(val !== prop) {
            prop = val;
            self._propHasChanged[id] = true;
            self._checkDeps = true;
          }
        }
      })
    };

    function applyArrayBinding(obj, key, prop) {
      var i = 0;
      //loop through all the array's children and apply getters and setters
      for(i = 0; i < prop.length; i++) {
        applyBinding(prop, i, prop[i], key + "[" + i + "]");
      }

      //detect when array functions are called
      Object.defineProperty(prop, "push", {
        value: function(val) {
          prop[prop.length] = val;
          self._propHasChanged[key] = true;
          self._checkDeps = true;
          //apply a binding to that new value too
          applyBinding(prop, i, prop[prop.length - 1], key + "[" + i + "]");
          //set all the children to changed
          for(i = 0; i < prop.length; i++) {
            self._propHasChanged[key + "[" + i + "]"] = true;
          }
        }
      });

      Object.defineProperty(prop, "splice", {
        value: function(start, deleteCount) {
          //items to add
          var itemsToAdd = [];
          for(var i = 2; i < arguments.length; i++) {
            itemsToAdd[itemsToAdd.length] = arguments[i];
          }
          var newArray = [];
          //now reconstruct new array
          for(var i = 0; i < prop.length; i++) {
            if(i >= start && i < start + deleteCount + 1) {
              if(itemsToAdd !== null && itemsToAdd.length > 0) {
                newArray.push.apply(newArray, itemsToAdd);
                itemsToAdd = null;
              }
              if(deleteCount === 0) {
                newArray.push(prop[i]);
              }
            } else {
              newArray.push(prop[i]);
            }
          }
          //set our array to the new array
          self[prop] = newArray;
          //apply the bindings to the new children
          applyBinding(self, key, self[prop], key);
          applyArrayBinding(self, key, self[prop]);
          //set props for the new array
          self._checkDeps = true;
        }
      });
    };

    for(var key in this) {
      if(key[0] !== "_") {
        var obj = this[key];
        if(!isFunction(obj)) {
          if(typeof obj === "string") {
            applyBinding(this, key, obj, key);
          } else if (Array.isArray(obj)) {
            applyBinding(this, key, obj, key);
            applyArrayBinding(this, key, obj);
          }
        }
      }
    }
  };

  Component.prototype.update = function() {
    if(this._checkDeps === true || this._init === false) {
      this._render();
      this._checkDeps = false;
    }
    requestAnimationFrame(this.update.bind(this));
  };

  Component.prototype._renderNode = function(root, rootChanges, parentHasChanges) {
    var val = null;
    var hasChanged = false;
    var i = 0;
    var s = 0;
    var ctx = null;

    if(Array.isArray(root)) {
      for(i = 0; i < root.length; i++) {
        this._renderNode(root[i], rootChanges, hasChanged);
      }
    } else {
      //check if this node has any dependencies
      if(root.deps != null) {
        //if so we run them and check vs our old deps
        for(s = 0; s < root.deps.length; s++) {
          if(this._propHasChanged[root.deps[s]] === true) {
            //changed
            hasChanged = true;
            break;
          }
        }
        if(hasChanged === true && parentHasChanges === false) {
          rootChanges.push(root);
        }
      }
      if(root.render != null && hasChanged === true) {
        if(root.children != null) {
          //TODO
          root.oldChildren = root.children;
        }
        ctx = byString(this, root.deps[s]);
        root.children = root.render(ctx);
      }
      if(root.children != null && typeof root.children !== "string") {
        this._renderNode(root.children, rootChanges, hasChanged);
      }
    }
  };

  Component.prototype._render = function() {
    var rootChanges = [];
    var level = 0;
    var i = 0;
    var s = 0;

    if(this._vDom === null) {
      this._vDom = this._template;
      this._renderNode(this._vDom, rootChanges, false, "root");
      this._vDom = cito.vdom.append(this._element, this._vDom);
    } else {
      if(this._init === false) {
        this._init = true;
        for(i = 0; i < rootChanges.length; i++) {
          for(s = 0; s < rootChanges[i].deps.length; s++) {
            this._propHasChanged[rootChanges[i].deps[s]] = false;
          }
        }
      } else {
        this._renderNode(this._vDom, rootChanges, false, "root");

        if(rootChanges.length > 0) {
          //seperated out, for faster performance
          for(i = 0; i < rootChanges.length; i++) {
            cito.vdom.updateChildren(
              rootChanges[i], rootChanges[i].children
            );
            for(s = 0; s < rootChanges[i].deps.length; s++) {
              this._propHasChanged[rootChanges[i].deps[s]] = false;
            }
          }
        }
      }
    }
  }

  return {
    String: String,
    Component: Component
  }
})();
