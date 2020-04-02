import Cocoa
import SafariServices

class ViewController: NSViewController {
    @IBOutlet weak var OpenSafari: NSButton!

    var isActivated = false
    override func viewDidLoad() {
        super.viewDidLoad()
        //Button custom
        OpenSafari.isBordered = false
        OpenSafari.wantsLayer = true
        OpenSafari.layer?.backgroundColor = NSColor.linkColor.cgColor
        OpenSafari.layer?.cornerRadius = 4
        var attributes = OpenSafari.attributedTitle.attributes(at: 0, effectiveRange: nil)
        attributes[.foregroundColor] = NSColor.white
        OpenSafari.attributedTitle = NSMutableAttributedString(string: OpenSafari.title,
                                                              attributes: attributes)
           Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { timer in
               SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: "io.cozy.pass.desktop.safari") { (state, error) in
                     if state?.isEnabled ?? false {
                        self.isActivated = true
                     }
                }
            }
    }
    override func viewDidAppear() {
            Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { timer in
                if(self.isActivated){
                    let successView = self.storyboard?.instantiateController(withIdentifier: NSStoryboard.SceneIdentifier("SuccessViewController"))
                        as! NSViewController
                    self.view.window?.contentViewController = successView
                }
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
