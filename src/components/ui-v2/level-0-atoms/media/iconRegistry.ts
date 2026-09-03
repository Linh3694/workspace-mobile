// ⚠️ FILE SINH TỰ ĐỘNG — đừng sửa tay.
// Chạy lại: node scripts/sync-icons-from-web.mjs
//
// Nguồn: frappe-sis-frontend/public/icon-v2 — cùng bộ icon với web, đã đổi màu
// cứng sang currentColor để tô được bằng prop `color` của react-native-svg.
import type React from 'react';
import type { SvgProps } from 'react-native-svg';

import Icon2Chat from '../../../../assets/icon-v2/2-chat.svg';
import DataSetPro from '../../../../assets/icon-v2/data-set-pro.svg';
import Activity from '../../../../assets/icon-v2/activity.svg';
import AddUser from '../../../../assets/icon-v2/add-user.svg';
import AiScan from '../../../../assets/icon-v2/ai-scan.svg';
import Aircon from '../../../../assets/icon-v2/aircon.svg';
import AlignCenter from '../../../../assets/icon-v2/align-center.svg';
import AlignJustify from '../../../../assets/icon-v2/align-justify.svg';
import AlignLeft from '../../../../assets/icon-v2/align-left.svg';
import AlignRight from '../../../../assets/icon-v2/align-right.svg';
import AlignVerticalSpaceAround from '../../../../assets/icon-v2/align-vertical-space-around.svg';
import Balloon from '../../../../assets/icon-v2/balloon.svg';
import Bandage from '../../../../assets/icon-v2/bandage.svg';
import Bell from '../../../../assets/icon-v2/bell.svg';
import Board from '../../../../assets/icon-v2/board.svg';
import Bold from '../../../../assets/icon-v2/bold.svg';
import BookSearch from '../../../../assets/icon-v2/book-search.svg';
import Book from '../../../../assets/icon-v2/book.svg';
import BubbleChat from '../../../../assets/icon-v2/bubble-chat.svg';
import Building from '../../../../assets/icon-v2/building.svg';
import Bus from '../../../../assets/icon-v2/bus.svg';
import CalendarBell from '../../../../assets/icon-v2/calendar-bell.svg';
import CalendarEdit from '../../../../assets/icon-v2/calendar-edit.svg';
import CalendarTime from '../../../../assets/icon-v2/calendar-time.svg';
import Calendar from '../../../../assets/icon-v2/calendar.svg';
import Card from '../../../../assets/icon-v2/card.svg';
import CardsBold from '../../../../assets/icon-v2/cards-bold.svg';
import Chart from '../../../../assets/icon-v2/chart.svg';
import Chat from '../../../../assets/icon-v2/chat.svg';
import CheckMark from '../../../../assets/icon-v2/check-mark.svg';
import Check from '../../../../assets/icon-v2/check.svg';
import CheckedIn from '../../../../assets/icon-v2/checked-in.svg';
import Checkin from '../../../../assets/icon-v2/checkin.svg';
import Checkout from '../../../../assets/icon-v2/checkout.svg';
import ChevronDown from '../../../../assets/icon-v2/chevron-down.svg';
import ChevronLeft from '../../../../assets/icon-v2/chevron-left.svg';
import ChevronRight from '../../../../assets/icon-v2/chevron-right.svg';
import ChevronUpDown from '../../../../assets/icon-v2/chevron-up-down.svg';
import ChevronUp from '../../../../assets/icon-v2/chevron-up.svg';
import Clock from '../../../../assets/icon-v2/clock.svg';
import Close from '../../../../assets/icon-v2/close.svg';
import Contacts from '../../../../assets/icon-v2/contacts.svg';
import Copy from '../../../../assets/icon-v2/copy.svg';
import Corn from '../../../../assets/icon-v2/corn.svg';
import DataSet from '../../../../assets/icon-v2/data-set.svg';
import DatabaseAdd from '../../../../assets/icon-v2/database-add.svg';
import DeleteStatic from '../../../../assets/icon-v2/delete-static.svg';
import Document from '../../../../assets/icon-v2/document.svg';
import DoubleCheck from '../../../../assets/icon-v2/double-check.svg';
import Download from '../../../../assets/icon-v2/download.svg';
import EyeOff from '../../../../assets/icon-v2/eye-off.svg';
import EyeOn from '../../../../assets/icon-v2/eye-on.svg';
import FaceId from '../../../../assets/icon-v2/face-id.svg';
import Filter from '../../../../assets/icon-v2/filter.svg';
import Folder from '../../../../assets/icon-v2/folder.svg';
import Food from '../../../../assets/icon-v2/food.svg';
import Globe from '../../../../assets/icon-v2/globe.svg';
import Health from '../../../../assets/icon-v2/health.svg';
import Hierarchy from '../../../../assets/icon-v2/hierarchy.svg';
import Highlight from '../../../../assets/icon-v2/highlight.svg';
import History from '../../../../assets/icon-v2/history.svg';
import Home from '../../../../assets/icon-v2/home.svg';
import Image from '../../../../assets/icon-v2/image.svg';
import InsuranceHand from '../../../../assets/icon-v2/insurance-hand.svg';
import Issue from '../../../../assets/icon-v2/issue.svg';
import Italic from '../../../../assets/icon-v2/italic.svg';
import Lamp from '../../../../assets/icon-v2/lamp.svg';
import Laptop from '../../../../assets/icon-v2/laptop.svg';
import Late from '../../../../assets/icon-v2/late.svg';
import Layout from '../../../../assets/icon-v2/layout.svg';
import ListBullet from '../../../../assets/icon-v2/list-bullet.svg';
import ListCheck from '../../../../assets/icon-v2/list-check.svg';
import ListClose from '../../../../assets/icon-v2/list-close.svg';
import ListNumber from '../../../../assets/icon-v2/list-number.svg';
import LoadingStatic from '../../../../assets/icon-v2/loading-static.svg';
import Location from '../../../../assets/icon-v2/location.svg';
import Medal from '../../../../assets/icon-v2/medal.svg';
import Megaphone from '../../../../assets/icon-v2/megaphone.svg';
import Minus from '../../../../assets/icon-v2/minus.svg';
import Money from '../../../../assets/icon-v2/money.svg';
import Monitor from '../../../../assets/icon-v2/monitor.svg';
import Monitoring from '../../../../assets/icon-v2/monitoring.svg';
import Moon from '../../../../assets/icon-v2/moon.svg';
import MoreHorizontal from '../../../../assets/icon-v2/more-horizontal.svg';
import MoreVertical from '../../../../assets/icon-v2/more-vertical.svg';
import More from '../../../../assets/icon-v2/more.svg';
import MynauiChevronRight from '../../../../assets/icon-v2/mynaui-chevron-right.svg';
import News from '../../../../assets/icon-v2/news.svg';
import Overdue from '../../../../assets/icon-v2/overdue.svg';
import Pdf from '../../../../assets/icon-v2/pdf.svg';
import Pen2 from '../../../../assets/icon-v2/pen-2.svg';
import PenRuler from '../../../../assets/icon-v2/pen-ruler.svg';
import Pen from '../../../../assets/icon-v2/pen.svg';
import PhoneTablet from '../../../../assets/icon-v2/phone-tablet.svg';
import PieChart from '../../../../assets/icon-v2/pie-chart.svg';
import Pill from '../../../../assets/icon-v2/pill.svg';
import Pin from '../../../../assets/icon-v2/pin.svg';
import Planet from '../../../../assets/icon-v2/planet.svg';
import Plus from '../../../../assets/icon-v2/plus.svg';
import Preferences from '../../../../assets/icon-v2/preferences.svg';
import Printer from '../../../../assets/icon-v2/printer.svg';
import Process from '../../../../assets/icon-v2/process.svg';
import Question from '../../../../assets/icon-v2/question.svg';
import Quote from '../../../../assets/icon-v2/quote.svg';
import Redo from '../../../../assets/icon-v2/redo.svg';
import RoadSign from '../../../../assets/icon-v2/road-sign.svg';
import Save from '../../../../assets/icon-v2/save.svg';
import School from '../../../../assets/icon-v2/school.svg';
import Search from '../../../../assets/icon-v2/search.svg';
import Send from '../../../../assets/icon-v2/send.svg';
import SeparatorHorizontal from '../../../../assets/icon-v2/separator-horizontal.svg';
import Setting from '../../../../assets/icon-v2/setting.svg';
import Shield from '../../../../assets/icon-v2/shield.svg';
import Sidebar from '../../../../assets/icon-v2/sidebar.svg';
import Smartphone from '../../../../assets/icon-v2/smartphone.svg';
import Speaker from '../../../../assets/icon-v2/speaker.svg';
import Star from '../../../../assets/icon-v2/star.svg';
import Stethoscope from '../../../../assets/icon-v2/stethoscope.svg';
import Strikethrough from '../../../../assets/icon-v2/strikethrough.svg';
import Student from '../../../../assets/icon-v2/student.svg';
import TagComment from '../../../../assets/icon-v2/tag-comment.svg';
import Ticket from '../../../../assets/icon-v2/ticket.svg';
import Translate from '../../../../assets/icon-v2/translate.svg';
import Tv from '../../../../assets/icon-v2/tv.svg';
import Undo from '../../../../assets/icon-v2/undo.svg';
import Update from '../../../../assets/icon-v2/update.svg';
import Upload from '../../../../assets/icon-v2/upload.svg';
import Usb from '../../../../assets/icon-v2/usb.svg';
import UserCheck from '../../../../assets/icon-v2/user-check.svg';
import UserLock from '../../../../assets/icon-v2/user-lock.svg';
import User from '../../../../assets/icon-v2/user.svg';
import Virus from '../../../../assets/icon-v2/virus.svg';
import VolumeOff from '../../../../assets/icon-v2/volume-off.svg';
import VolumeOn from '../../../../assets/icon-v2/volume-on.svg';

/** Tên icon hợp lệ — gõ sai sẽ bị TypeScript bắt ngay tại callsite. */
export type IconV2Name =
  | '2-chat'
  | 'data-set-pro'
  | 'activity'
  | 'add-user'
  | 'ai-scan'
  | 'aircon'
  | 'align-center'
  | 'align-justify'
  | 'align-left'
  | 'align-right'
  | 'align-vertical-space-around'
  | 'balloon'
  | 'bandage'
  | 'bell'
  | 'board'
  | 'bold'
  | 'book-search'
  | 'book'
  | 'bubble-chat'
  | 'building'
  | 'bus'
  | 'calendar-bell'
  | 'calendar-edit'
  | 'calendar-time'
  | 'calendar'
  | 'card'
  | 'cards-bold'
  | 'chart'
  | 'chat'
  | 'check-mark'
  | 'check'
  | 'checked-in'
  | 'checkin'
  | 'checkout'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up-down'
  | 'chevron-up'
  | 'clock'
  | 'close'
  | 'contacts'
  | 'copy'
  | 'corn'
  | 'data-set'
  | 'database-add'
  | 'delete-static'
  | 'document'
  | 'double-check'
  | 'download'
  | 'eye-off'
  | 'eye-on'
  | 'face-id'
  | 'filter'
  | 'folder'
  | 'food'
  | 'globe'
  | 'health'
  | 'hierarchy'
  | 'highlight'
  | 'history'
  | 'home'
  | 'image'
  | 'insurance-hand'
  | 'issue'
  | 'italic'
  | 'lamp'
  | 'laptop'
  | 'late'
  | 'layout'
  | 'list-bullet'
  | 'list-check'
  | 'list-close'
  | 'list-number'
  | 'loading-static'
  | 'location'
  | 'medal'
  | 'megaphone'
  | 'minus'
  | 'money'
  | 'monitor'
  | 'monitoring'
  | 'moon'
  | 'more-horizontal'
  | 'more-vertical'
  | 'more'
  | 'mynaui-chevron-right'
  | 'news'
  | 'overdue'
  | 'pdf'
  | 'pen-2'
  | 'pen-ruler'
  | 'pen'
  | 'phone-tablet'
  | 'pie-chart'
  | 'pill'
  | 'pin'
  | 'planet'
  | 'plus'
  | 'preferences'
  | 'printer'
  | 'process'
  | 'question'
  | 'quote'
  | 'redo'
  | 'road-sign'
  | 'save'
  | 'school'
  | 'search'
  | 'send'
  | 'separator-horizontal'
  | 'setting'
  | 'shield'
  | 'sidebar'
  | 'smartphone'
  | 'speaker'
  | 'star'
  | 'stethoscope'
  | 'strikethrough'
  | 'student'
  | 'tag-comment'
  | 'ticket'
  | 'translate'
  | 'tv'
  | 'undo'
  | 'update'
  | 'upload'
  | 'usb'
  | 'user-check'
  | 'user-lock'
  | 'user'
  | 'virus'
  | 'volume-off'
  | 'volume-on';

export const ICON_V2: Record<IconV2Name, React.FC<SvgProps>> = {
  '2-chat': Icon2Chat,
  'data-set-pro': DataSetPro,
  'activity': Activity,
  'add-user': AddUser,
  'ai-scan': AiScan,
  'aircon': Aircon,
  'align-center': AlignCenter,
  'align-justify': AlignJustify,
  'align-left': AlignLeft,
  'align-right': AlignRight,
  'align-vertical-space-around': AlignVerticalSpaceAround,
  'balloon': Balloon,
  'bandage': Bandage,
  'bell': Bell,
  'board': Board,
  'bold': Bold,
  'book-search': BookSearch,
  'book': Book,
  'bubble-chat': BubbleChat,
  'building': Building,
  'bus': Bus,
  'calendar-bell': CalendarBell,
  'calendar-edit': CalendarEdit,
  'calendar-time': CalendarTime,
  'calendar': Calendar,
  'card': Card,
  'cards-bold': CardsBold,
  'chart': Chart,
  'chat': Chat,
  'check-mark': CheckMark,
  'check': Check,
  'checked-in': CheckedIn,
  'checkin': Checkin,
  'checkout': Checkout,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up-down': ChevronUpDown,
  'chevron-up': ChevronUp,
  'clock': Clock,
  'close': Close,
  'contacts': Contacts,
  'copy': Copy,
  'corn': Corn,
  'data-set': DataSet,
  'database-add': DatabaseAdd,
  'delete-static': DeleteStatic,
  'document': Document,
  'double-check': DoubleCheck,
  'download': Download,
  'eye-off': EyeOff,
  'eye-on': EyeOn,
  'face-id': FaceId,
  'filter': Filter,
  'folder': Folder,
  'food': Food,
  'globe': Globe,
  'health': Health,
  'hierarchy': Hierarchy,
  'highlight': Highlight,
  'history': History,
  'home': Home,
  'image': Image,
  'insurance-hand': InsuranceHand,
  'issue': Issue,
  'italic': Italic,
  'lamp': Lamp,
  'laptop': Laptop,
  'late': Late,
  'layout': Layout,
  'list-bullet': ListBullet,
  'list-check': ListCheck,
  'list-close': ListClose,
  'list-number': ListNumber,
  'loading-static': LoadingStatic,
  'location': Location,
  'medal': Medal,
  'megaphone': Megaphone,
  'minus': Minus,
  'money': Money,
  'monitor': Monitor,
  'monitoring': Monitoring,
  'moon': Moon,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  'more': More,
  'mynaui-chevron-right': MynauiChevronRight,
  'news': News,
  'overdue': Overdue,
  'pdf': Pdf,
  'pen-2': Pen2,
  'pen-ruler': PenRuler,
  'pen': Pen,
  'phone-tablet': PhoneTablet,
  'pie-chart': PieChart,
  'pill': Pill,
  'pin': Pin,
  'planet': Planet,
  'plus': Plus,
  'preferences': Preferences,
  'printer': Printer,
  'process': Process,
  'question': Question,
  'quote': Quote,
  'redo': Redo,
  'road-sign': RoadSign,
  'save': Save,
  'school': School,
  'search': Search,
  'send': Send,
  'separator-horizontal': SeparatorHorizontal,
  'setting': Setting,
  'shield': Shield,
  'sidebar': Sidebar,
  'smartphone': Smartphone,
  'speaker': Speaker,
  'star': Star,
  'stethoscope': Stethoscope,
  'strikethrough': Strikethrough,
  'student': Student,
  'tag-comment': TagComment,
  'ticket': Ticket,
  'translate': Translate,
  'tv': Tv,
  'undo': Undo,
  'update': Update,
  'upload': Upload,
  'usb': Usb,
  'user-check': UserCheck,
  'user-lock': UserLock,
  'user': User,
  'virus': Virus,
  'volume-off': VolumeOff,
  'volume-on': VolumeOn,
};

export const ICON_V2_NAMES = Object.keys(ICON_V2) as IconV2Name[];
