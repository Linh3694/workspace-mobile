# Workspace Mobile App

A React Native mobile application for the Wellspring staff portal, providing access to chat, device management, ticketing system, and social features.

## Features

- **Authentication**: Microsoft SSO integration with biometric authentication
- **Chat System**: Real-time messaging with emoji reactions, file sharing, and message forwarding
- **Device Management**: Track and manage device assignments, report broken devices
- **Ticketing System**: Create and manage support tickets with real-time updates
- **Wislife Social**: Internal social platform for staff engagement
- **Notifications**: Push notifications for important updates

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: React Navigation
- **State Management**: React Context
- **Real-time Communication**: Socket.IO
- **Authentication**: Microsoft Graph API
- **UI Components**: Custom components with consistent design system

## Project Structure

```
src/
├── assets/          # Images, fonts, and static assets
├── components/      # Reusable UI components
├── context/         # React Context providers
├── hooks/           # Custom React hooks
├── navigation/      # Navigation configuration
├── screens/         # Screen components
├── services/        # API services
├── theme/           # Design tokens and styling
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Linh3694/workspace-mobile.git
cd workspace-mobile
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npx expo start
```

4. Run on your preferred platform:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your device

## Configuration

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
API_BASE_URL=your_api_base_url
MICROSOFT_CLIENT_ID=your_microsoft_client_id
SOCKET_URL=your_socket_server_url
```

### Build Configuration

The app uses Expo Application Services (EAS) for building and deployment. Configuration is available in `eas.json`.

## Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Key Features Implementation

### Authentication Flow
- Microsoft SSO integration
- Biometric authentication for enhanced security
- Secure token management

### Real-time Chat
- Socket.IO integration for real-time messaging
- Message reactions and replies
- File and image sharing
- Message forwarding and pinning

### Device Management
- Device assignment tracking
- Broken device reporting
- Assignment history

### Ticketing System
- Create and manage support tickets
- Real-time ticket updates
- File attachments
- Status tracking

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software developed for Wellspring internal use.

## Support

For support and questions, please contact the development team or create an issue in this repository. 