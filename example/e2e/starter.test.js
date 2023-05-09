import puppeteer from 'puppeteer';

const { expect: jestExpect } = require('expect');

describe('Example', () => {
  beforeAll(async () => {
    //await device.launchApp();
  });

  it('should have welcome screen', async () => {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        `--use-fake-device-for-media-stream`,
        `--use-fake-ui-for-media-stream`,
        `--no-sandbox`,
        `--use-file-for-fake-video-capture=./e2e/sample_1280x720.mjpeg`,
      ],
    });

    try {
      // await waitFor(element(by.id('create-room')))
      //   .toBeVisible()
      //   .withTimeout(2000);
      // await element(by.id('create-room')).tap();
      // await element(by.id('room-name')).typeText('room');
      // await element(by.id('user-name')).typeText('android\n');
      // await element(by.id('create-room-btn')).tap();
      // await element(by.id('join-room-btn')).tap();

      const context = browser.defaultBrowserContext();
      await context.overridePermissions('http://localhost:4001/', [
        'camera',
        'microphone',
      ]);

      const page = await browser.newPage();

      page.on('console', async (msg) => {
        const msgArgs = msg.args();
        for (let i = 0; i < msgArgs.length; ++i) {
          console.log('PAGE LOG: ', await msgArgs[i].jsonValue());
        }
      });

      await page.goto('http://localhost:4001');

      await page.setViewport({ width: 1080, height: 1024 });

      await page.click('button[id="start-simulcast"]');

      console.log('WAITING FOR CONNECTION');

      // await waitFor(element(by.id('video-renderer-android')))
      //   .toBeVisible()
      //   .withTimeout(15000);

      // await waitFor(element(by.id('video-renderer-web')))
      //   .toBeVisible()
      //   .withTimeout(150000);

      // console.log('VIDEO VISIBLE ON MOBILE');

      await page.waitForTimeout(5000);

      await page.screenshot({ path: 'screen1.png' });

      // todo: extract stats checking to separate function
      await page.click('button[id="simulcast-inbound-stats"]');

      console.log('STATS CLICKED');

      await page.waitForTimeout(5000);

      await page.screenshot({ path: 'screen2.png' });

      const dataDiv = await page.$('div[id="data"]');
      const data = JSON.parse(
        await (await dataDiv.getProperty('textContent')).jsonValue()
      );

      console.log('STATS:', data);

      jestExpect(data.framesReceived).toBeGreaterThan(0);
      jestExpect(data.framesPerSecond).toBeGreaterThan(0);
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      await browser.close();
    }
  }, 500000);
});
