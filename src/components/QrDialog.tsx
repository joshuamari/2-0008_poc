import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'

const SAMPLES = [
  { code: 'MTR-2200', label: 'Single match' },
  { code: 'BLT-M12', label: 'Four matches' },
  { code: 'FLG-5010', label: 'Inlet flange' },
  { code: 'NO-PART', label: 'No match' },
]

type Props = {
  onClose: () => void
  onCode: (code: string) => void
}

export default function QrDialog({ onClose, onCode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [images, setImages] = useState<Record<string, string>>({})
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraNote, setCameraNote] = useState('Point the camera at a part tag.')

  useEffect(() => {
    let cancel = false
    void Promise.all(
      SAMPLES.map(async (sample) => {
        const url = await QRCode.toDataURL(sample.code, {
          margin: 1,
          width: 160,
          color: { dark: '#221e1a', light: '#f7f4ee' },
        })
        return [sample.code, url] as const
      }),
    ).then((entries) => {
      if (!cancel) setImages(Object.fromEntries(entries))
    })
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false

    const stop = () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }

    const start = async () => {
      if (!('BarcodeDetector' in window)) {
        setCameraNote('This browser cannot read QR codes from the camera. Use a sample tag below.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        video.srcObject = stream
        await video.play()
        setCameraOn(true)
        const detector = new BarcodeDetector({ formats: ['qr_code'] })
        const tick = async () => {
          if (stopped) return
          try {
            const codes = await detector.detect(video)
            const value = codes[0]?.rawValue
            if (value) {
              onCode(value)
              return
            }
          } catch {
            setCameraNote('The camera is on, but QR reading failed. Use a sample tag.')
            return
          }
          timer = window.setTimeout(() => void tick(), 250)
        }
        void tick()
      } catch {
        setCameraNote('Camera permission was blocked. Use a sample tag below.')
      }
    }

    void start()
    return stop
  }, [onCode])

  return (
    <div className="qr-overlay" role="presentation" onClick={onClose}>
      <div
        className="qr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="qr-head">
          <div>
            <p className="kicker">Scan QR code</p>
            <h2 id="qr-title">Part tag</h2>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="camera-note">{cameraNote}</p>
        <video ref={videoRef} className={cameraOn ? 'qr-video' : 'qr-video is-hidden'} muted playsInline />
        <p className="kicker">Sample tags</p>
        <div className="qr-grid">
          {SAMPLES.map((sample) => (
            <button key={sample.code} type="button" className="qr-card" onClick={() => onCode(sample.code)}>
              {images[sample.code] ? <img src={images[sample.code]} alt="" /> : <span className="qr-placeholder" />}
              <span className="mono">{sample.code}</span>
              <span>{sample.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
