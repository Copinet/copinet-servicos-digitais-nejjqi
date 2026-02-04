
import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Label>Início</Label>
        <Icon sf={{ default: 'house', selected: 'house.fill' }} drawable="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="services">
        <Label>Serviços</Label>
        <Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} drawable="description" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <Label>Pedidos</Label>
        <Icon sf={{ default: 'receipt', selected: 'receipt.fill' }} drawable="receipt" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>Perfil</Label>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} drawable="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
