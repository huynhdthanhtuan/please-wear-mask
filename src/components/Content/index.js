import "./Content.css";
import sound from "./sound";
import TrainDontTouchButton from "../Buttons/TrainDontTouchButton";
import TrainTouchedButton from "../Buttons/TrainTouchedButton";
import RunButton from "../Buttons/RunButton";

import { useEffect, useRef, useState } from "react";
import { initNotifications, notify } from "@mycv/f8-notification";
import { DONT_TOUCH_LABEL, TOUCHED_LABEL, TRAINING_TIMES } from "./constants";

import "@tensorflow/tfjs-backend-cpu";
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as knnClassifier from "@tensorflow-models/knn-classifier";

function Content() {
  const videoRef = useRef();
  const mobilenetModel = useRef();
  const classifierModel = useRef();
  const canPlaySound = useRef(true);

  const [isReady, setIsReady] = useState(false);
  const [progessPercent, setProgessPercent] = useState(0);
  const [isTouched, setIsTouched] = useState(false);
  const [isEnabledTrainDontTouch, setIsEnabledTrainDontTouch] = useState(false);
  const [isEnabledTrainTouched, setIsEnabledTrainTouched] = useState(false);
  const [isEnabledRun, setIsEnabledRun] = useState(false);

  const init = async () => {
    console.log("Khởi chạy ứng dụng...");
    await setupCamera();
    console.log("Thiết lập camera thành công...");

    // Dùng thư viện
    mobilenetModel.current = await mobilenet.load();
    classifierModel.current = knnClassifier.create();

    console.log("Ứng dụng đã sẵn sàng...");
    setIsReady(true);
    setIsEnabledTrainDontTouch(true);
  };

  const setupCamera = () => {
    return new Promise(async (resolve, reject) => {
      // Lấy ra đối tượng getUserMedia
      const getUserMedia =
        navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

      if (getUserMedia) {
        // Yêu cầu của luồng video
        const constraints = { video: { facingMode: "user" } };

        // Lấy ra luồng video của thiết bị
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Thêm luồng video vào thuộc tính src của thẻ video
        videoRef.current.srcObject = stream;

        // Kích hoạt khi thẻ video tải xong luồng video trên
        videoRef.current.addEventListener("loadeddata", resolve);

        resolve();
      } else {
        reject(
          new Error("getUserMedia không được hỗ trợ trong trình duyệt này!!")
        );
      }
    });
  };

  const train = async (label) => {
    // Set về giá trị mặc định (0%)
    setProgessPercent(0);

    for (let i = 0; i < TRAINING_TIMES; i++) {
      // setState để chạy tiến độ
      setProgessPercent(parseInt(((i + 1) / TRAINING_TIMES) * 100));

      // training
      await training(label);
    }

    // Bước 1 xong: Ẩn bước 1, hiện bước 2
    if (label === DONT_TOUCH_LABEL) {
      setIsEnabledTrainDontTouch(false);
      setIsEnabledTrainTouched(true);
    }
    // Bước 2 xong: Ẩn bước 2, hiện bước 3
    else {
      setIsEnabledTrainTouched(false);
      setIsEnabledRun(true);
    }
  };

  const training = (label) => {
    return new Promise(async (resolve) => {
      // Train luồng ảnh hiện tại
      const embedding = mobilenetModel.current.infer(videoRef.current, true);

      // Máy học luồng ảnh hiện tại
      classifierModel.current.addExample(embedding, label);

      await sleep(100);
      resolve();
    });
  };

  const run = async () => {
    // Train luồng ảnh hiện tại
    const embedding = mobilenetModel.current.infer(videoRef.current, true);

    // So sánh luồng ảnh hiện tại với dữ liệu đã train trước đó
    const result = await classifierModel.current.predictClass(embedding);

    // Nếu chạm tay lên mặt
    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[TOUCHED_LABEL] === 1
    ) {
      setIsTouched(true);

      // Phát ra âm thanh cảnh báo
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }

      // Show cảnh báo
      showNotification();
    } else {
      setIsTouched(false);
    }

    await sleep(200);
    run();
  };

  const sleep = (milisec) => {
    return new Promise((resolve) => setTimeout(resolve, milisec));
  };

  const showNotification = () => {
    notify("Bỏ tay xuống!!", { body: "Vui lòng bỏ tay xuống!!!" });
  };

  useEffect(() => {
    init();

    // Khởi tạo thông báo
    initNotifications({ cooldown: 3000 });

    // Kích hoạt khi âm thanh được phát xong
    sound.on("end", () => {
      canPlaySound.current = true;
    });
  }, []);

  return (
    <div className={"app " + (isTouched ? "touched" : "")}>
      <div className="main">
        <h5 className="title mt-2">Ứng dụng "Đừng chạm tay lên mặt"</h5>

        <video ref={videoRef} className="videoElement" autoPlay />

        <div className="control">
          {isReady ? (
            <>
              {isEnabledTrainDontTouch && (
                <TrainDontTouchButton
                  onClick={train}
                  progessPercent={progessPercent}
                />
              )}
              {isEnabledTrainTouched && (
                <TrainTouchedButton
                  onClick={train}
                  progessPercent={progessPercent}
                />
              )}
              {isEnabledRun && (
                <RunButton onClick={run} progessPercent={progessPercent} />
              )}
            </>
          ) : (
            <h5 className="mt-2 guide-text">Đang tải...</h5>
          )}
        </div>
      </div>
    </div>
  );
}

export default Content;
