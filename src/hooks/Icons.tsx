import { Eye } from "lucide-react";
import type { MouseEventHandler } from "react";
export const EditIcon = () => {
    return (
        <svg
            width="31"
            height="31"
            viewBox="0 0 41 41"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
        >
            <rect x="0.635742" y="0.164062" width="40" height="40" fill="url(#pattern0_205_2454)" />
            <defs>
                <pattern id="pattern0_205_2454" patternContentUnits="objectBoundingBox" width="1" height="1">
                    <use xlinkHref="#image0_205_2454" transform="scale(0.02)" />
                </pattern>
                <image
                    id="image0_205_2454"
                    width="50"
                    height="50"
                    xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAACBElEQVR4nO2ZzUobURTHz95dxQalmHOmFa3GR6gKdlt8knahBDdqV9n5gQ/hQhd1kbpScJcX0QoK/UjuOUEXEpmrhJq5JjOTeycTvD84hEC4d35z//djJgAeTzom6qOAUgHiY/0Zfh863qs5ILkCkla7kC+GT4b48JlEW0YqMFQUWiNAch6V4R/xGyFVAOTvgPITUE77K96Bd//eWJPBuCOCzUUg+Wsc1tTFtZ79BqoEJF96yFzFmyPhSFiXeKrgdqqrBMo1IN8ByopZho/0AhCLME4uJIjv9U3qJkHtlcksk4hwTrgQQd6NJUG2ZEyrBMoJIK+nKlJrEKjlRBL0n4xpzqQX4TLYptiYiWx2FLmBNxCo+fyKOJfIQiQTCdcimUm4FNH7E//qIXEdf58YmAjvZSfhUiQ8fneTCFQJrOJCZLIxm62EKxGUb2YRvnwxTpM8DlifzpvIQUQgPLIE6q35Gnj/8Wymf1tL9wjgQqSolrQMylcoNj527199NsRvO79HlBf7b64aRM6GTwS5bJhP58kb8iKWQD8iHfhoWQJ9tDrw0bIE+mh14KNlCfTRelXRkvSvTBOXnNgRcfUSu59CqaYQ4a2BXzhFor2RXCR8jib5M/CLp3b9hg+NseQielSaC7qBPEhQ8xP0RXgXkDd1Pvv+MzRxVXWcUo+Ex+PxQE55ALqA51ZtQ0WXAAAAAElFTkSuQmCC"
                />
            </defs>
        </svg>
    );
};

export const DeleteIcon = () => {
    return (
        <svg
            width="31"
            height="31"
            viewBox="0 0 41 41"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
        >
            <rect x="0.635742" y="0.164062" width="40" height="40" fill="url(#pattern0_205_2450)" />
            <defs>
                <pattern id="pattern0_205_2450" patternContentUnits="objectBoundingBox" width="1" height="1">
                    <use xlinkHref="#image0_205_2450" transform="scale(0.02)" />
                </pattern>
                <image
                    id="image0_205_2450"
                    width="50"
                    height="50"
                    xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB5ElEQVR4nO2ZMUscURDHnwSUFNEPoGCcWREUPWcWEkmjheAnECxNEysrBRsLO/MFLEQkXSoLwTKEEMiBhYWIjYIoIuq+tyrYWa2st7e3SvQU325edH7wb+694ebP/JmDd0oJgruEH7xmTTCrCdYNwd69YvgdEE5G3d2NyjXCUmerYdwxjNHjBWXzqeudcglN+PNpJhIRLClXOCthT7Y5TTgf9ncM/00B44hhXE7vMlyd+9CiXEATjGWMbNa7H42qN5rxoloT+p0flQsEDOO1acCvx9QYxv3UvI9DuTdpfJwyjIsPKW6+lnk8rnc/qbnM1KzVux8wjD/LyK0m/6UIv4mRGMP4RTN+jWUItwqewp/qd2vfG1W2iMdbsJE5a82/NiM76YapbKDqKr68s32yNd8zNcduGKHaRol/EzJn+7fqMzUnpfb3dTcjiZGHkYkkSLRsI9FKkGjZRqKVINGyjUQrQaJlG4lWgkTLNhKtBImWbV5+tBg3DMHMjTKvJZrxPP28cpbWVB780rM9V4xE/9W7liZYKNQI43QuRgKCz0Ua0f3eYC5GDgfa3mrGg2KMQDlSqkHlxSl19GmGo1wnwbAd9nptKm/iPy/j/GqGVc34w5YM44ohmNj1vKbcTQiCICgXuAZvjOzo0Gtm+wAAAABJRU5ErkJggg=="
                />
            </defs>
        </svg>
    );
};

type ViewIconProps = {
  className?: string;
  onClick?: MouseEventHandler<SVGSVGElement>;
};

export const ViewIcon = ({ className = "", onClick }: ViewIconProps) => (
  <Eye className={`w-5 h-5 ${className}`} onClick={onClick} />
);
