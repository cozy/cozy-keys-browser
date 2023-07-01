
/***
 * from https://www.npmjs.com/package/play-dtmf
 */

export type Dtmf = '*' | '#' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'A' | 'B' | 'C' | 'D';

export interface Tone {
	stop(when?: number): void;
}

export interface Config {
	dtmf?: number;
	ringing?: number;
}

export class PhoneTonePlayer {
	constructor(private audioContext: AudioContext, private config: Config = {}) {}

	playDtmf(key: Dtmf): Tone {
    console.log("playDtmf", key);
		switch (key) {
			case '1': return this.playDtmfTone(697, 1209);
			case '2': return this.playDtmfTone(697, 1336);
			case '3': return this.playDtmfTone(697, 1477);
			case '4': return this.playDtmfTone(770, 1209);
			case '5': return this.playDtmfTone(770, 1336);
			case '6': return this.playDtmfTone(770, 1477);
			case '7': return this.playDtmfTone(852, 1209);
			case '8': return this.playDtmfTone(852, 1336);
			case '9': return this.playDtmfTone(852, 1477);
			case '*': return this.playDtmfTone(941, 1209);
			case '0': return this.playDtmfTone(941, 1336);
			case '#': return this.playDtmfTone(941, 1477);
			case 'A': return this.playDtmfTone(697, 1633);
			case 'B': return this.playDtmfTone(770, 1633);
			case 'C': return this.playDtmfTone(852, 1633);
			case 'D': return this.playDtmfTone(941, 1633);
		}
	}

	playRinging(): Tone {
		// https://www.etsi.org/deliver/etsi_tr/101000_101099/10104102/01.01.01_60/tr_10104102v010101p.pdf
		const gain = this.config.ringing ?? 0.1;
		const gainNode = new GainNode(this.audioContext, {gain});
		gainNode.connect(this.audioContext.destination);

		const oscillator = this.createOscillator(425);
		oscillator.connect(gainNode);
		oscillator.start();

		const play = () => {
			gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + 1.5);
			gainNode.gain.setValueAtTime(gain, this.audioContext.currentTime + 4.5);
		};
		play();

		const timer = setInterval(() => {
			play();
		}, 4500);

		return {
			stop(): void {
				clearInterval(timer);
				oscillator.stop();
				gainNode.disconnect();
			}
		}
	}

	private createOscillator(freq: number): OscillatorNode {
		return new OscillatorNode(this.audioContext, {
			type: 'sine',
			frequency: freq,
		});
	}

	private playDtmfTone(freq1: number, freq2: number): Tone {
		const gainNode = new GainNode(this.audioContext, {gain: this.config.dtmf ?? 0.1})
		gainNode.connect(this.audioContext.destination);

		const oscillator1 = this.createOscillator(freq1);
		const oscillator2 = this.createOscillator(freq2);

		oscillator1.connect(gainNode)
		oscillator2.connect(gainNode);

		oscillator1.start();
		oscillator2.start();

		const audioContext = this.audioContext;
		return {
			stop(when = 0): void {
				oscillator2.onended = () => gainNode.disconnect();
				oscillator1.stop(audioContext.currentTime + when);
				oscillator2.stop(audioContext.currentTime + when);
			}
		}
	}
}
