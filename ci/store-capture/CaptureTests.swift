import XCTest

final class CaptureTests: XCTestCase {
    func capture(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    func testStoreScreens() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.kevthedev.dailycompass.mobile")
        app.launch()
        let loginMode = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Already have an account")).firstMatch
        XCTAssertTrue(loginMode.waitForExistence(timeout: 25))
        loginMode.tap()
        let email = app.textFields.matching(NSPredicate(format: "label CONTAINS[c] %@ OR placeholderValue CONTAINS[c] %@", "Email", "you@example.com")).firstMatch
        XCTAssertTrue(email.waitForExistence(timeout: 5))
        email.tap()
        email.typeText(ProcessInfo.processInfo.environment["CAPTURE_EMAIL"]!)
        let password = app.secureTextFields.firstMatch
        password.tap()
        password.typeText(ProcessInfo.processInfo.environment["CAPTURE_PASSWORD"]!)
        app.buttons["Log in →"].tap()
        let calm = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Calm")).firstMatch
        XCTAssertTrue(calm.waitForExistence(timeout: 30))
        calm.tap()
        app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Continue to my day")).firstMatch.tap()
        let today = app.buttons["Today"]
        XCTAssertTrue(today.waitForExistence(timeout: 20))
        sleep(4)
        capture(app, "01-today")
        for section in ["Tasks", "Health", "Community"] {
            let button = app.buttons[section]
            XCTAssertTrue(button.exists)
            button.tap()
            sleep(2)
            capture(app, section.lowercased())
        }
        today.tap()
        app.buttons["Your profile and settings"].tap()
        app.buttons["Explore Plus →"].tap()
        XCTAssertTrue(app.staticTexts["More support for your day"].waitForExistence(timeout: 10))
        sleep(5)
        capture(app, "compass-plus")
    }
}
