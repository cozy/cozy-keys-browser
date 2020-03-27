import Cocoa
import SafariServices

class ViewController: NSViewController {
    @IBOutlet weak var OpenSafari: NSButton!

    var timer = Timer()
var isActivated = false
    override func viewDidLoad() {
        super.viewDidLoad()
        
        if #available(OSX 10.12, *) {
           Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { timer in
               SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: "io.cozy.pass.desktop.safari") { (state, error) in
                     if state?.isEnabled ?? false {
                        self.isActivated = true
                     }
                }
            }
        } else {
            // Fallback on earlier versions
        }
    }
    override func viewDidAppear() {
        if #available(OSX 10.12, *) {
            Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { timer in
                if(self.isActivated){
                    let successView = self.storyboard?.instantiateController(withIdentifier: NSStoryboard.SceneIdentifier("SuccessViewController"))
                        as! NSViewController
                    self.view.window?.contentViewController = successView
                }
            }
        } else {
            // Fallback on earlier versions
        }
    }
    override var representedObject: Any? {
        didSet {
            // Update the view, if already loaded.
        }
    }
    
    @IBAction func buttonTapped(button: NSButton)
    {
       SFSafariApplication.showPreferencesForExtension(withIdentifier: "io.cozy.pass.desktop.safari") { (error) in
           if error != nil {
            print("Error launching the extension's preferences: %@", error as Any);
               return;
           }
        }
    }
}

/**

 var error: NSDictionary?
 if let scriptObject = NSAppleScript(source: myAppleScript) {
     if let output: NSAppleEventDescriptor = scriptObject.executeAndReturnError(
                                                                        &error) {
         print(output.stringValue)
     } else if (error != nil) {
         print("error: \(error)")
     }
 }
 */
