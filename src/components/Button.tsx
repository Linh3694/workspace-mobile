import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline';
}

export const Button: React.FC<ButtonProps> = ({
    title,
    variant = 'primary',
    className,
    ...props
}) => {
    const getVariantClasses = () => {
        switch (variant) {
            case 'primary':
                return 'bg-primary';
            case 'secondary':
                return 'bg-secondary';
            case 'outline':
                return 'border border-primary bg-transparent';
            default:
                return 'bg-primary';
        }
    };

    return (
        <TouchableOpacity
            className={`px-4 py-2 rounded-lg ${getVariantClasses()} ${className}`}
            {...props}
        >
            <Text
                className={`text-center font-semibold ${variant === 'outline' ? 'text-primary' : 'text-white'
                    }`}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
}; 